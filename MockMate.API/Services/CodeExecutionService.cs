using System.Net;
using System.Text;
using System.Text.Json;
using MockMate.API.Models;

namespace MockMate.API.Services
{
    // "Run" does not execute code: the LLM predicts what the program would print.
    // The UI labels this output as AI-estimated.
    public class CodeExecutionService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<CodeExecutionService> _logger;
        private readonly string _apiKey;
        private readonly string _model;
        private readonly string? _reasoningEffort;
        private const string DefaultModel = "openai/gpt-oss-20b";
        private readonly JsonSerializerOptions _jsonOptions;

        // Sentinel the model returns when the program prints nothing; the client
        // turns it into guidance ("call your function and print the result").
        public const string NoOutputMarker = "(no output)";

        public CodeExecutionService(HttpClient httpClient, IConfiguration configuration, ILogger<CodeExecutionService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _apiKey = configuration["GroqApiKey"] ?? "";
            // Groq retires models over time; override with the GroqModel setting instead of editing code.
            _model = configuration["GroqModel"] is { Length: > 0 } m ? m : DefaultModel;
            // Low reasoning keeps a run at roughly 650 tokens instead of ~2,400, which matters on
            // Groq's 8,000 tokens-per-minute free tier (shared with the interviewer chat). Set
            // GroqRunReasoningEffort to "" for models that don't support reasoning_effort.
            var effort = configuration["GroqRunReasoningEffort"];
            _reasoningEffort = effort is null ? "low" : (effort.Length > 0 ? effort : null);
            _jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        }

        public async Task<ExecuteResult> ExecuteCodeAsync(ExecuteRequest request)
        {
            var prompt = $@"You are a code execution engine.
Predict exactly what the following {request.Language} program prints to stdout when it runs.
Rules:
1. Return ONLY the program's output, nothing else. No explanations, no code fences.
2. If it throws or fails to compile, return the error message the runtime would show.
3. If it would loop forever, return: Error: Timeout
4. If it runs but prints nothing, return exactly: {NoOutputMarker}

Program:
{request.Code}";

            var requestData = new Dictionary<string, object>
            {
                ["model"] = _model,
                ["messages"] = new[]
                {
                    new { role = "system", content = "You are a command line terminal. Output only the result of the code execution." },
                    new { role = "user", content = prompt }
                },
                ["temperature"] = 0.0
            };
            if (_reasoningEffort is not null) requestData["reasoning_effort"] = _reasoningEffort;

            var jsonContent = JsonSerializer.Serialize(requestData, _jsonOptions);
            var requestMsg = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
            {
                Content = new StringContent(jsonContent, Encoding.UTF8, "application/json")
            };
            requestMsg.Headers.Add("Authorization", $"Bearer {_apiKey}");

            try
            {
                var response = await _httpClient.SendAsync(requestMsg);
                var responseString = await response.Content.ReadAsStringAsync();

                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    var wait = GroqHttp.RetryAfterSeconds(response);
                    _logger.LogWarning("Groq rate limit hit on /api/code/run; retry after {Seconds}s", wait);
                    return new ExecuteResult { Error = GroqHttp.RateLimitMessage(wait) };
                }

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Groq /api/code/run failed with {Status}: {Body}", (int)response.StatusCode, responseString);
                    return new ExecuteResult { Error = "The AI couldn't estimate the output right now. Try again in a moment." };
                }

                var groqResponse = JsonSerializer.Deserialize<GroqApiResponse>(responseString, _jsonOptions);
                var output = (groqResponse?.Choices?.FirstOrDefault()?.Message?.Content ?? "")
                    .Replace("```", "")
                    .Trim();

                // An empty answer means the model saw no printed output too.
                if (output.Length == 0) output = NoOutputMarker;

                return new ExecuteResult { Output = output };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Groq /api/code/run threw");
                return new ExecuteResult { Error = "Couldn't reach the AI service. Check the server's connection and try again." };
            }
        }
    }
}

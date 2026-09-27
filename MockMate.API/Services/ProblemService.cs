using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MockMate.API.Models;

namespace MockMate.API.Services
{
    // Generates Practice problems as a spec the browser can actually run:
    // a single pure function, JSON test cases, and a hidden JavaScript reference
    // solution the browser uses to confirm each expected answer.
    public class ProblemService
    {
        private const string DefaultModel = "openai/gpt-oss-20b";
        private static readonly Regex Identifier = new("^[A-Za-z_$][A-Za-z0-9_$]*$", RegexOptions.Compiled);

        private readonly HttpClient _httpClient;
        private readonly ILogger<ProblemService> _logger;
        private readonly string _apiKey;
        private readonly string _model;
        private readonly string? _reasoningEffort;
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
        };

        public ProblemService(HttpClient httpClient, IConfiguration configuration, ILogger<ProblemService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _apiKey = configuration["GroqApiKey"] ?? "";
            _model = configuration["GroqModel"] is { Length: > 0 } m ? m : DefaultModel;
            // Correct expected answers matter more than speed here; the browser also
            // double-checks them against the reference solution.
            var effort = configuration["GroqProblemReasoningEffort"];
            _reasoningEffort = effort is null ? "medium" : (effort.Length > 0 ? effort : null);
        }

        public async Task<ProblemResponse> GenerateAsync(string topic, string difficulty)
        {
            // One retry: the model occasionally returns a spec that fails validation.
            for (var attempt = 1; attempt <= 2; attempt++)
            {
                var (problem, error, retryAfter) = await RequestAsync(topic, difficulty);
                if (problem is not null) return Build(problem);
                if (retryAfter is null || attempt == 2) return new ProblemResponse { Error = error };
                if (retryAfter > 0) await Task.Delay(TimeSpan.FromSeconds(retryAfter.Value));
            }
            return new ProblemResponse { Error = "The AI couldn't write a problem right now. Try again in a moment." };
        }

        private async Task<(GeneratedProblem? Problem, string Error, int? RetryAfter)> RequestAsync(string topic, string difficulty)
        {
            var prompt = $@"Create one {difficulty} coding-interview problem about {topic}.

The candidate implements ONE pure function that takes arguments and RETURNS the answer. No classes, no reading input, no printing.
Every parameter and the return value must use one of these types: int, double, string, bool, int[], double[], string[], bool[], int[][], string[][]. ""int"" is a whole number that fits in 32 bits. No objects, maps, null values or other types. Represent linked lists as int[] of values and binary trees as level-order int[] (so avoid problems whose trees need missing nodes), and say so in the description.

Return only JSON in exactly this shape:
{{
  ""title"": ""Human-readable title in Title Case, e.g. Longest Subarray Divisible by K (not the function name)"",
  ""description"": ""Markdown problem statement, 1-3 short paragraphs. Refer to the function by name."",
  ""examples"": [{{""input"": ""nums = [2,7,11,15], target = 9"", ""output"": ""[0,1]"", ""explanation"": ""optional, one sentence""}}],
  ""constraints"": [""short bullet""],
  ""functionName"": ""camelCaseName"",
  ""params"": [""camelCaseParam""],
  ""paramTypes"": [""int[]""],
  ""returnType"": ""int"",
  ""orderMatters"": true,
  ""tests"": [{{""args"": [[2,7,11,15], 9], ""expected"": [0,1]}}],
  ""referenceSolution"": ""function camelCaseName(camelCaseParam) {{ ... }}""
}}

Rules:
- 2 examples. 6 tests: the examples first, then edge cases (empty or minimal input, duplicates, negatives, boundaries) that fit the constraints.
- Each test's ""args"" has exactly one value per entry in ""params"", in order.
- Every test must have exactly ONE correct answer. If several answers could be valid (ties, multiple pairs, several longest substrings), add a tie-break rule to the description, such as ""return the one that starts first"".
- ""orderMatters"" is false only when any order of the returned array is accepted.
- ""referenceSolution"" is a correct, efficient JavaScript implementation of the function with the same name and parameters. It is hidden from the candidate.
- Keep test inputs small.";

            var requestData = new Dictionary<string, object>
            {
                ["model"] = _model,
                ["messages"] = new[]
                {
                    new { role = "system", content = "You write precise coding-interview problems with verified test cases. Work out every expected answer carefully." },
                    new { role = "user", content = prompt }
                },
                ["temperature"] = 0.7,
                // No response_format: Groq's JSON mode fails ("json_validate_failed") when the
                // model's reasoning runs long. We extract the JSON object ourselves instead.
                ["max_completion_tokens"] = 8192,
            };
            if (_reasoningEffort is not null) requestData["reasoning_effort"] = _reasoningEffort;

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
            {
                Content = new StringContent(JsonSerializer.Serialize(requestData, _jsonOptions), Encoding.UTF8, "application/json")
            };
            httpRequest.Headers.Add("Authorization", $"Bearer {_apiKey}");

            try
            {
                var response = await _httpClient.SendAsync(httpRequest);
                var body = await response.Content.ReadAsStringAsync();

                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    var wait = GroqHttp.RetryAfterSeconds(response);
                    _logger.LogWarning("Groq rate limit hit on problem generation; retry after {Seconds}s", wait);
                    // Short waits are absorbed here so the user just sees a slower Generate.
                    return (null, GroqHttp.RateLimitMessage(wait), wait is > 0 and <= 6 ? wait : null);
                }
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Groq problem generation failed with {Status}: {Body}", (int)response.StatusCode, body);
                    return (null, "The AI couldn't write a problem right now. Try again in a moment.", 0);
                }

                var content = JsonSerializer.Deserialize<GroqApiResponse>(body, _jsonOptions)?.Choices?.FirstOrDefault()?.Message?.Content;
                var json = ExtractJsonObject(content);
                var problem = json is null ? null : JsonSerializer.Deserialize<GeneratedProblem>(json, _jsonOptions);
                var invalid = problem is null ? "empty answer" : Invalid(problem);
                if (invalid is not null)
                {
                    _logger.LogWarning("Groq problem spec rejected ({Reason}): {Content}", invalid, content);
                    return (null, "The AI wrote a problem that couldn't be tested. Try generating again.", 0);
                }
                return (problem, "", null);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Groq problem generation returned invalid JSON");
                return (null, "The AI wrote a problem that couldn't be read. Try generating again.", 0);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Groq problem generation threw");
                return (null, "Couldn't reach the AI service. Check the server's connection and try again.", null);
            }
        }

        // The model sometimes wraps its JSON in code fences or adds a stray sentence.
        private static string? ExtractJsonObject(string? content)
        {
            if (string.IsNullOrWhiteSpace(content)) return null;
            var start = content.IndexOf('{');
            var end = content.LastIndexOf('}');
            return start >= 0 && end > start ? content[start..(end + 1)] : null;
        }

        private static string? Invalid(GeneratedProblem p)
        {
            if (string.IsNullOrWhiteSpace(p.Title) || string.IsNullOrWhiteSpace(p.Description)) return "missing title or description";
            if (!Identifier.IsMatch(p.FunctionName)) return "bad function name";
            if (p.Params.Count is < 1 or > 6 || p.Params.Any(x => !Identifier.IsMatch(x))) return "bad params";
            if (p.Tests.Count is < 3 or > 12) return "wrong number of tests";
            if (p.Tests.Any(t => t.Args.Count != p.Params.Count)) return "test args don't match params";
            if (p.Tests.Any(t => t.Expected.ValueKind == JsonValueKind.Undefined)) return "test without expected";
            if (p.ParamTypes.Count != p.Params.Count || !p.ParamTypes.All(CodeTemplates.IsValidType)) return "bad param types";
            if (!CodeTemplates.IsValidType(p.ReturnType)) return "bad return type";
            if (p.Tests.Any(t => t.Args.Where((a, i) => !CodeTemplates.ValueMatches(a, p.ParamTypes[i])).Any())) return "test args don't match their types";
            if (p.Tests.Any(t => !CodeTemplates.ValueMatches(t.Expected, p.ReturnType))) return "expected value doesn't match the return type";
            if (string.IsNullOrWhiteSpace(p.ReferenceSolution) || !p.ReferenceSolution.Contains(p.FunctionName)) return "missing reference solution";
            return null;
        }

        private static ProblemResponse Build(GeneratedProblem p)
        {
            var md = new StringBuilder();
            md.AppendLine($"## {p.Title.Trim()}").AppendLine();
            md.AppendLine(p.Description.Trim()).AppendLine();
            var signature = $"{p.FunctionName}({string.Join(", ", p.Params.Select((x, i) => $"{x}: {p.ParamTypes[i]}"))}) -> {p.ReturnType}";
            md.AppendLine($"Implement `{signature}` and **return** the answer. Check runs it against {p.Tests.Count} tests.").AppendLine();

            if (p.Examples.Count > 0)
            {
                md.AppendLine("**Examples**").AppendLine();
                foreach (var ex in p.Examples.Take(3))
                {
                    md.AppendLine("```text");
                    md.AppendLine($"Input:  {ex.Input.Trim()}");
                    md.AppendLine($"Output: {ex.Output.Trim()}");
                    if (!string.IsNullOrWhiteSpace(ex.Explanation)) md.AppendLine($"Why:    {ex.Explanation.Trim()}");
                    md.AppendLine("```").AppendLine();
                }
            }
            if (p.Constraints.Count > 0)
            {
                md.AppendLine("**Constraints**").AppendLine();
                foreach (var c in p.Constraints.Take(6)) md.AppendLine($"- {c.Trim()}");
            }

            var spec = new ProblemSpec
            {
                Title = p.Title.Trim(),
                FunctionName = p.FunctionName,
                Params = p.Params,
                ParamTypes = p.ParamTypes.Select(t => t.Trim()).ToList(),
                ReturnType = p.ReturnType.Trim(),
                OrderMatters = p.OrderMatters,
                Tests = p.Tests,
                ReferenceSolution = p.ReferenceSolution,
            };
            spec.Starters = CodeTemplates.Starters(spec);
            return new ProblemResponse { Problem = md.ToString(), Spec = spec };
        }
    }
}

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using MockMate.API.Models;

namespace MockMate.API.Services
{
    public class GroqAiService : IAiService
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiKey;
        private readonly string _model;
        private const string DefaultModel = "openai/gpt-oss-20b";

        private const string StyleRules =
            " Formatting rules: write plain, natural English that sounds right when read aloud." +
            " Never use emoji. Never use em-dashes or en-dashes; use a comma, period, colon, or parentheses instead." +
            " Markdown is fine for code blocks, short lists, and bold key terms.";
        private readonly JsonSerializerOptions _jsonOptions;
        private readonly ConversationStore _store;

        public GroqAiService(HttpClient httpClient, IConfiguration configuration, ConversationStore store)
        {
            _httpClient = httpClient;
            _apiKey = configuration["GroqApiKey"];
            // Groq retires models over time; override with the GroqModel setting instead of editing code.
            _model = configuration["GroqModel"] is { Length: > 0 } m ? m : DefaultModel;
            _store = store;
            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            };
        }

        public async Task<AiResponse> GetResponseAsync(UserInput input, string sessionId)
        {
            // Per-session history — isolated by SignalR connection id, fresh each interview
            var history = _store.GetHistory(sessionId);

            // 1. Determine the System Persona based on Mode
            string systemPrompt = "You are a helpful technical interviewer.";

            switch (input.Mode)
            {
                case "Google":
                    systemPrompt = "You are a Senior Google Staff Engineer. You care deeply about Big O notation, scalability, and edge cases. You are strict. If the user writes O(n^2) code, question it immediately. Do not be polite; be rigorous. Begin the interview by stating ONE concrete algorithmic coding problem for the candidate to solve, including a short example input/output. Then evaluate their approach as they work.";
                    break;
                case "Startup":
                    systemPrompt = "You are a CTO of a fast-paced YCombinator startup. You care about speed, shipping features, and clean, readable code. You don't care about micro-optimizations. You want to see if the candidate can build things fast. Begin the interview by giving the candidate ONE concrete, practical coding task to build, with a short example. Then review their solution as they go.";
                    break;
                case "SystemDesign":
                    systemPrompt = "You are a Principal Engineer conducting a system design interview. Do NOT ask for code. Focus on architecture: requirements gathering, API design, data modeling, scalability, load balancing, caching, database choice and sharding, and trade-offs. Push the candidate to justify decisions and discuss bottlenecks at scale. Begin by giving the candidate ONE concrete system to design (e.g. a URL shortener, a news feed, a rate limiter). Ask one focused question at a time, under 3 sentences.";
                    break;
                case "Meta":
                    systemPrompt = "You are a Senior Meta (Facebook) Frontend Engineer running a front-end interview. The candidate writes code in the editor. Begin by giving them ONE concrete, interactive UI component to build (e.g. a typeahead search, an image carousel, a todo list with filters), with a short spec and example. Care about component structure, state management, accessibility, and rendering performance, plus product/UX sense. Review their implementation as they work and push on edge cases and performance.";
                    break;
                case "SQL":
                    systemPrompt = "You are a Senior Data Engineer running a SQL interview. The candidate writes real SQL in the editor. Begin by describing ONE concrete schema (a few tables with their columns) and ask for ONE query against it, with a short example of the expected output. Care about correctness, joins, aggregation, indexing, and window functions. Review their query, point out bugs or performance problems, and progressively raise the difficulty.";
                    break;
                case "DevOps":
                    systemPrompt = "You are a Platform / SRE Lead running a DevOps interview. The candidate writes config (YAML, Dockerfiles, shell) in the editor. Begin with ONE concrete, practical task — e.g. write a CI pipeline, a Kubernetes manifest, or a Dockerfile, or debug a broken deployment described in a short scenario. Care about CI/CD, containers, infrastructure-as-code, observability, and reliability trade-offs. Review their solution and probe how it behaves in production.";
                    break;
                case "Behavioral":
                    systemPrompt = "You are an HR Manager. Do not ask for code. Ask about conflict resolution, leadership principles, and past experiences. Use the STAR method.";
                    break;
                case "Amazon":
                    systemPrompt = "You are an Amazon Bar Raiser running a behavioral interview. Do NOT ask for code. Probe past experiences strictly through Amazon's Leadership Principles (Customer Obsession, Ownership, Dive Deep, Bias for Action, Deliver Results, and the rest). Require concrete, structured answers using the STAR method (Situation, Task, Action, Result) and dig into the candidate's specific individual contribution, not the team's. Ask ONE focused question at a time, under 3 sentences. Begin with one Leadership-Principle-based behavioral question.";
                    break;
                case "Resume": 
                    systemPrompt = "You are a tough Hiring Manager. The user has provided their resume. Your job is to GRILL them on it. Pick one specific project or skill from the resume they provided and ask a highly technical follow-up question. Do not just summarize their resume. Ask them 'Why did you choose X over Y?' or 'How did you scale Z?'. Keep your question under 3 sentences.";
                    break;
                default: // Standard
                    systemPrompt = "You are a friendly but professional technical interviewer. Begin the interview by giving the candidate ONE concrete coding problem to solve, with a short example input/output, then guide them through it.";
                    break;
            }

            // Replies are shown in the chat and read aloud by text-to-speech.
            systemPrompt += StyleRules;

            // 2. Add User's new message to history
            var userMessage = new
            {
                role = "user",
                content = $"[Mode: {input.Mode}]\n[Current Code]:\n{input.CurrentCode}\n\n[Candidate Says]:\n{input.Text}"
            };

            // 3. Reset history if it's the start, or update system prompt context
            if (history.Count == 0)
            {
                history.Add(new { role = "system", content = systemPrompt });
            }

            history.Add(userMessage);

            while (history.Count > 8)
            {
                history.RemoveAt(1);
            }

            // 4. Prepare the Request
            var requestData = new
            {

                model = _model,
                messages = history,
                temperature = 0.6
            };

            var jsonContent = JsonSerializer.Serialize(requestData, _jsonOptions);
            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            request.Content = httpContent;

            // 5. Send
            var response = await _httpClient.SendAsync(request);
            var responseString = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"❌ Groq Error: {responseString}");
                return new AiResponse { Message = "I had trouble thinking. Please try again." };
            }

            var groqResponse = JsonSerializer.Deserialize<GroqApiResponse>(responseString, _jsonOptions);
            var aiText = groqResponse?.Choices?.FirstOrDefault()?.Message?.Content ?? "";

            // 6. Add AI's response to history
            history.Add(new { role = "assistant", content = aiText });

            return new AiResponse
            {
                Message = aiText,
                IsCodeRequest = false
            };
        }

        public async Task<InterviewFeedback> GenerateFeedbackAsync(string sessionId)
        {
            var history = _store.GetHistory(sessionId);

            // 1. Create a special "Grader" prompt
            var feedbackPrompt = new
            {
                role = "system",
                content = @"
            The interview is over. You are now a Hiring Manager. 
            Analyze the conversation history. 
            Provide a JSON response in this EXACT format (no markdown, just raw JSON):
            {
                ""codingScore"": (integer 1-10),
                ""communicationScore"": (integer 1-10),
                ""feedbackPoints"": [""point 1"", ""point 2"", ""point 3""]
            }
            Be honest and critical."
            };

            // 2. Temporarily add this instruction to history
            var feedbackHistory = new List<object>(history);
            feedbackHistory.Add(feedbackPrompt);

            // 3. Send to Groq
            var requestData = new
            {
                model = _model,
                messages = feedbackHistory,
                response_format = new { type = "json_object" }, 
                temperature = 0.2
            };

            var jsonContent = JsonSerializer.Serialize(requestData, _jsonOptions);
            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            request.Content = httpContent;

            var response = await _httpClient.SendAsync(request);
            var responseString = await response.Content.ReadAsStringAsync();

            // A failed grading call must surface as an error, not as a fake 0/10
            // report: the hub keeps the history on failure so the client can retry.
            if (!response.IsSuccessStatusCode)
                throw new HttpRequestException($"Groq grading request failed with status {(int)response.StatusCode}.");

            // 4. Parse the JSON result
            var groqResponse = JsonSerializer.Deserialize<GroqApiResponse>(responseString, _jsonOptions);
            var rawJson = groqResponse?.Choices?.FirstOrDefault()?.Message?.Content
                ?? throw new InvalidOperationException("Groq grading response had no content.");

            InterviewFeedback? feedback;
            try
            {
                feedback = JsonSerializer.Deserialize<InterviewFeedback>(rawJson, _jsonOptions);
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException("Groq grading response was not valid JSON.", ex);
            }

            if (feedback is null
                || feedback.CodingScore is < 1 or > 10
                || feedback.CommunicationScore is < 1 or > 10)
                throw new InvalidOperationException("Groq grading response had missing or out-of-range scores.");

            feedback.FeedbackPoints ??= new();
            return feedback;
        }
    }

    // -- Helper Classes --
    public class GroqApiResponse { public List<GroqChoice> Choices { get; set; } }
    public class GroqChoice { public GroqMessage Message { get; set; } }
    public class GroqMessage { public string Content { get; set; } }
}
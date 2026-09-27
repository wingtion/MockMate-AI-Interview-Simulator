using System.Text.Json;

namespace MockMate.API.Models
{
    // What the model returns for a Practice problem (parsed from its JSON answer).
    public class GeneratedProblem
    {
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public List<ProblemExample> Examples { get; set; } = new();
        public List<string> Constraints { get; set; } = new();
        public string FunctionName { get; set; } = "";
        public List<string> Params { get; set; } = new();
        public List<string> ParamTypes { get; set; } = new();   // see CodeTemplates.IsValidType
        public string ReturnType { get; set; } = "";
        public bool OrderMatters { get; set; } = true;
        public List<ProblemTest> Tests { get; set; } = new();
        public string ReferenceSolution { get; set; } = "";   // JavaScript
    }

    public class ProblemExample
    {
        public string Input { get; set; } = "";
        public string Output { get; set; } = "";
        public string Explanation { get; set; } = "";
    }

    // Arguments and expected value are arbitrary JSON, so they stay as raw elements.
    public class ProblemTest
    {
        public List<JsonElement> Args { get; set; } = new();
        public JsonElement Expected { get; set; }
    }

    // Sent to the browser, and posted back when the user runs or checks a solution.
    public class ProblemSpec
    {
        public string Title { get; set; } = "";
        public string FunctionName { get; set; } = "";
        public List<string> Params { get; set; } = new();
        public List<string> ParamTypes { get; set; } = new();
        public string ReturnType { get; set; } = "";
        public bool OrderMatters { get; set; } = true;
        public List<ProblemTest> Tests { get; set; } = new();
        public string ReferenceSolution { get; set; } = "";
        public Dictionary<string, string> Starters { get; set; } = new();   // language id -> starter code
    }

    public class ProblemResponse
    {
        public string Problem { get; set; } = "";   // Markdown shown to the user
        public ProblemSpec? Spec { get; set; }
        public string Error { get; set; } = "";
    }

    // POST /api/problem/check-ai (Java, C#, C++, Go, Rust; JS/TS/Python run in the browser)
    public class PracticeRunRequest
    {
        public ProblemSpec Spec { get; set; } = new();
        public string Code { get; set; } = "";
        public string Language { get; set; } = "javascript";
        public string Mode { get; set; } = "check";   // "check" = all tests, "example" = the first test only
    }

    public class TestOutcome
    {
        public int Index { get; set; }
        public bool Passed { get; set; }
        public string? Actual { get; set; }            // the returned value, as JSON text
        public bool ReturnedNothing { get; set; }      // undefined / None
        public string? Error { get; set; }
        public List<string> Logs { get; set; } = new();
    }

    public class PracticeRunResult
    {
        public List<TestOutcome> Results { get; set; } = new();
        public List<string> Logs { get; set; } = new();  // printed before the first test (top-level code)
        public string Error { get; set; } = "";          // compile error, AI unavailable, rate limit, ...
        public bool CompileError { get; set; }
    }
}

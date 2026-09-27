namespace MockMate.API.Models
{
    public class ExecuteRequest
    {
        public string Language { get; set; } = "javascript";
        public string Code { get; set; } = "";
    }

    public class ExecuteResult
    {
        public string Output { get; set; } = "";
        public string Error { get; set; } = "";
        // Server runs are always "estimated" (predicted by the LLM); the browser labels its
        // own real runs "executed". The UI shows which one produced the output.
        public string Source { get; set; } = "estimated";
    }

    // Piston API specific structure
    public class PistonRequest
    {
        public string language { get; set; }
        public string version { get; set; } = "*";
        public PistonFile[] files { get; set; }
    }
    public class PistonFile { public string content { get; set; } }

    public class PistonResponse
    {
        public PistonRun run { get; set; }
    }
    public class PistonRun
    {
        public string stdout { get; set; }
        public string stderr { get; set; }
    }
}
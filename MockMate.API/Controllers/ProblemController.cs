using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MockMate.API.Models;
using MockMate.API.Services;

namespace MockMate.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProblemController : ControllerBase
    {
        private readonly ProblemService _problems;
        private readonly AiCheckService _checker;

        public ProblemController(ProblemService problems, AiCheckService checker)
        {
            _problems = problems;
            _checker = checker;
        }

        // Returns { problem: Markdown, spec: { functionName, params, paramTypes, returnType, orderMatters,
        // tests, referenceSolution, starters }, error }. `error` is set (spec null) when the AI
        // couldn't produce a testable problem.
        [HttpGet("generate")]
        public async Task<IActionResult> GetProblem([FromQuery] string topic = "Arrays", [FromQuery] string difficulty = "Medium")
        {
            var result = await _problems.GenerateAsync(topic, difficulty);
            return Ok(result);
        }

        // AI check for Java, C#, C++, Go and Rust (JS, TS and Python run in the browser).
        // The model predicts each test's return value; the server grades it against the
        // expected answer. Mode "example" checks only the first test (the Practice "Run" button).
        [HttpPost("check")]
        [EnableRateLimiting("code-runs")]
        public async Task<IActionResult> Check([FromBody] PracticeRunRequest request, CancellationToken ct)
        {
            var invalid = AiCheckService.Validate(request);
            if (invalid is not null) return Ok(new PracticeRunResult { Error = invalid });
            return Ok(await _checker.CheckAsync(request, ct));
        }
    }
}

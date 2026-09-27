using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MockMate.API.Models;
using MockMate.API.Services;

namespace MockMate.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CodeController : ControllerBase
    {
        private readonly CodeExecutionService _estimator;

        public CodeController(CodeExecutionService estimator)
        {
            _estimator = estimator;
        }

        // The interview room's "Run" for languages the browser can't execute (Java, C#,
        // C++, Go, Rust, SQL, YAML). The output is estimated by the LLM and labelled as
        // such (Source = "estimated"). JavaScript, TypeScript and Python run in the browser.
        [HttpPost("run")]
        [EnableRateLimiting("code-runs")]
        public async Task<IActionResult> RunCode([FromBody] ExecuteRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Code)) return Ok(new ExecuteResult { Error = "There's no code to run.", Source = "estimated" });
            if (request.Code.Length > 20_000) return Ok(new ExecuteResult { Error = "That program is too long to run.", Source = "estimated" });

            var result = await _estimator.ExecuteCodeAsync(request);
            result.Source = "estimated";
            return Ok(result);
        }
    }
}

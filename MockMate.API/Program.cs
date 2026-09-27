using System.Threading.RateLimiting;
using MockMate.API.Hubs;
using MockMate.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddSignalR(); // Enable SignalR

builder.Services.AddHttpClient();

// Per-session interview history, isolated by SignalR connection id
builder.Services.AddSingleton<ConversationStore>();

builder.Services.AddScoped<IAiService, GroqAiService>();

builder.Services.AddScoped<CodeExecutionService>();
builder.Services.AddScoped<ProblemService>();
builder.Services.AddScoped<AiCheckService>();   // AI check for Java, C#, C++, Go, Rust

// Server runs and AI checks share the Groq free tier (tokens per minute), so each
// visitor gets a modest budget. Fly puts the real client address in Fly-Client-IP.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("code-runs", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Request.Headers["Fly-Client-IP"].FirstOrDefault() ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(10), QueueLimit = 0 }));
    options.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.ContentType = "application/json";
        await ctx.HttpContext.Response.WriteAsync(
            "{\"error\":\"You've run code a lot in the last few minutes. Wait a little and try again.\"}", ct);
    };
});

// Allowed browser origins for CORS. localhost is always permitted for local dev;
// production origins (the Netlify URL) come from the "AllowedOrigins" config /
// the `AllowedOrigins` Fly secret (comma-separated).
var allowedOrigins = new List<string> { "http://localhost:5173" };
var configuredOrigins = builder.Configuration["AllowedOrigins"];
if (!string.IsNullOrWhiteSpace(configuredOrigins))
{
    allowedOrigins.AddRange(
        configuredOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins.ToArray())
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Note: HTTPS is terminated at the Fly.io edge (force_https in fly.toml) and at
// Netlify for the frontend, so no in-app UseHttpsRedirection is needed. Adding it
// here would only emit "failed to determine https port" warnings behind the proxy.

app.UseCors("ReactPolicy"); // Activate CORS
app.UseRateLimiter();

app.MapControllers();
app.MapHub<InterviewHub>("/interviewHub"); // The URL will be https://localhost:xxxx/interviewHub

app.Run();

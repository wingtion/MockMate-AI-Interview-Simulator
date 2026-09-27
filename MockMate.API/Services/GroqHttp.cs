using System.Globalization;

namespace MockMate.API.Services
{
    // Small helpers shared by the services that call Groq directly.
    public static class GroqHttp
    {
        // Groq sends Retry-After in seconds on 429s.
        public static int? RetryAfterSeconds(HttpResponseMessage response)
        {
            if (response.Headers.RetryAfter?.Delta is { } delta) return (int)Math.Ceiling(delta.TotalSeconds);
            if (response.Headers.TryGetValues("retry-after", out var values)
                && double.TryParse(values.FirstOrDefault(), NumberStyles.Float, CultureInfo.InvariantCulture, out var secs))
                return (int)Math.Ceiling(secs);
            return null;
        }

        // Wording for the free tier's limits (shared by every feature). Short waits come from
        // the per-minute token limit; long ones from the daily token quota.
        public static string RateLimitMessage(int? waitSeconds) => waitSeconds switch
        {
            > 90 => $"The free AI tier's usage limit is reached for now. Try again in about {(waitSeconds.Value + 59) / 60} minutes.",
            > 0 => $"The free AI tier's per-minute limit is used up. Try again in about {waitSeconds} seconds.",
            _ => "The free AI tier's per-minute limit is used up. Try again in a few seconds.",
        };
    }
}

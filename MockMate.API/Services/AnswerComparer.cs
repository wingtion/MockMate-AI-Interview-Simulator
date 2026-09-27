using System.Globalization;
using System.Text.Json;

namespace MockMate.API.Services
{
    // Compares a returned value with a test's expected value. Mirrors answersMatch()
    // in the browser (mockmate-ui/src/lib/practice.ts) so both engines grade alike:
    // numbers within 1e-6, top-level arrays unordered when order doesn't matter,
    // and null accepted for an expected empty array.
    public static class AnswerComparer
    {
        public static bool Matches(JsonElement actual, JsonElement expected, bool orderMatters) =>
            Same(actual, expected, orderMatters, top: true);

        private static bool Same(JsonElement a, JsonElement e, bool orderMatters, bool top)
        {
            if (a.ValueKind == JsonValueKind.Null && e.ValueKind == JsonValueKind.Array && e.GetArrayLength() == 0) return true;
            if (a.ValueKind == JsonValueKind.Number && e.ValueKind == JsonValueKind.Number)
            {
                var x = a.GetDouble(); var y = e.GetDouble();
                return Math.Abs(x - y) <= 1e-6 * Math.Max(1, Math.Abs(y));
            }
            if (a.ValueKind != e.ValueKind) return false;
            switch (a.ValueKind)
            {
                case JsonValueKind.String: return a.GetString() == e.GetString();
                case JsonValueKind.Array:
                {
                    var xs = a.EnumerateArray().ToList();
                    var ys = e.EnumerateArray().ToList();
                    if (xs.Count != ys.Count) return false;
                    if (!orderMatters && top)
                    {
                        xs = xs.OrderBy(Canonical, StringComparer.Ordinal).ToList();
                        ys = ys.OrderBy(Canonical, StringComparer.Ordinal).ToList();
                    }
                    for (var i = 0; i < xs.Count; i++) if (!Same(xs[i], ys[i], orderMatters, top: false)) return false;
                    return true;
                }
                case JsonValueKind.Object:
                {
                    var xp = a.EnumerateObject().ToDictionary(p => p.Name, p => p.Value);
                    var yp = e.EnumerateObject().ToDictionary(p => p.Name, p => p.Value);
                    return xp.Count == yp.Count && xp.All(kv => yp.TryGetValue(kv.Key, out var v) && Same(kv.Value, v, orderMatters, top: false));
                }
                default: return true;   // true/false/null with equal kinds
            }
        }

        // Stable text form for sorting unordered results (numbers normalised).
        private static string Canonical(JsonElement v) => v.ValueKind switch
        {
            JsonValueKind.Number => Math.Round(v.GetDouble(), 6).ToString("R", CultureInfo.InvariantCulture),
            JsonValueKind.Array => "[" + string.Join(",", v.EnumerateArray().Select(Canonical)) + "]",
            JsonValueKind.Object => "{" + string.Join(",", v.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal).Select(p => p.Name + ":" + Canonical(p.Value))) + "}",
            _ => v.GetRawText(),
        };
    }
}

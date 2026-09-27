using System.Text.Json;
using System.Text.RegularExpressions;
using MockMate.API.Models;

namespace MockMate.API.Services
{
    // Typed Practice signatures: which types a problem may use, and the starter
    // code shown for each of the eight editor languages.
    public static class CodeTemplates
    {
        public static readonly string[] Languages = { "javascript", "typescript", "python", "java", "csharp", "cpp", "go", "rust" };

        private static readonly HashSet<string> BaseTypes = new() { "int", "double", "string", "bool" };

        // Identifiers that are reserved (or awkward) in at least one supported language.
        private static readonly HashSet<string> Reserved = new()
        {
            "type", "range", "func", "map", "var", "len", "fn", "match", "impl", "string", "int", "char", "new", "class",
            "default", "case", "object", "in", "is", "as", "ref", "out", "params", "base", "operator", "struct", "trait",
            "use", "mod", "self", "loop", "move", "where", "let", "const", "static", "final", "package", "import",
            "interface", "select", "chan", "go", "defer", "switch", "return", "if", "else", "for", "while", "do", "break",
            "continue", "true", "false", "null", "nil", "none", "lambda", "pass", "def", "del", "global", "not", "and",
            "or", "from", "with", "yield", "assert", "async", "await", "try", "except", "raise", "finally", "vec", "list",
            "bool", "double", "float", "long", "short", "byte", "void", "this", "super", "delete", "typeof", "function",
        };

        // ---- Types ---------------------------------------------------------------------

        public static (string Base, int Depth) Split(string type)
        {
            var t = type.Trim();
            var depth = 0;
            while (t.EndsWith("[]")) { depth++; t = t[..^2]; }
            return (t, depth);
        }

        // Scalars and 1-D arrays of int/double/string/bool; 2-D arrays of int/string.
        public static bool IsValidType(string type)
        {
            var (b, d) = Split(type);
            if (!BaseTypes.Contains(b) || d > 2) return false;
            return d < 2 || b is "int" or "string";
        }

        public static bool ValueMatches(JsonElement v, string type)
        {
            var (b, d) = Split(type);
            if (d > 0)
            {
                if (v.ValueKind != JsonValueKind.Array) return false;
                var inner = b + string.Concat(Enumerable.Repeat("[]", d - 1));
                return v.EnumerateArray().All(e => ValueMatches(e, inner));
            }
            return b switch
            {
                "int" => v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out _),
                "double" => v.ValueKind == JsonValueKind.Number,
                "string" => v.ValueKind == JsonValueKind.String,
                "bool" => v.ValueKind is JsonValueKind.True or JsonValueKind.False,
                _ => false,
            };
        }

        // `qualified` spells C++ types as std::vector / std::string.
        private static string TypeName(string lang, string type, bool qualified = false)
        {
            var (b, d) = Split(type);
            var std = qualified ? "std::" : "";
            var bt = lang switch
            {
                "java" => b switch { "string" => "String", "bool" => "boolean", _ => b },
                "go" => b switch { "double" => "float64", _ => b },
                "rust" => b switch { "int" => "i32", "double" => "f64", "string" => "String", _ => b },
                "typescript" => b switch { "int" or "double" => "number", "bool" => "boolean", _ => b },
                "cpp" => b == "string" ? $"{std}string" : b,
                _ => b,   // csharp
            };
            return lang switch
            {
                "java" or "csharp" or "typescript" => bt + string.Concat(Enumerable.Repeat("[]", d)),
                "go" => string.Concat(Enumerable.Repeat("[]", d)) + bt,
                "cpp" => Wrap(bt, d, $"{std}vector<", ">"),
                "rust" => Wrap(bt, d, "Vec<", ">"),
                _ => "",
            };
        }

        private static string Wrap(string inner, int depth, string open, string close)
        {
            for (var i = 0; i < depth; i++) inner = open + inner + close;
            return inner;
        }

        // ---- Names ---------------------------------------------------------------------

        public static string Snake(string name) =>
            Regex.Replace(Regex.Replace(name, "([a-z0-9])([A-Z])", "$1_$2"), "([A-Z])([A-Z][a-z])", "$1_$2").ToLowerInvariant();

        public static string FunctionName(string lang, string name) => lang switch
        {
            "python" or "rust" => Snake(name),
            "csharp" => char.ToUpperInvariant(name[0]) + name[1..],
            _ => name,
        };

        public static string ParamName(string lang, string name)
        {
            var n = lang is "python" or "rust" ? Snake(name) : name;
            return Reserved.Contains(n.ToLowerInvariant()) ? n + "_" : n;
        }

        private static string DefaultReturn(string lang, string type)
        {
            var (b, d) = Split(type);
            if (d > 0) return lang switch
            {
                "java" => $"new {TypeName(lang, type)[..TypeName(lang, type).IndexOf('[')]}[0]{string.Concat(Enumerable.Repeat("[]", d - 1))}",
                "csharp" => $"new {TypeName(lang, type)[..TypeName(lang, type).IndexOf('[')]}[0]{string.Concat(Enumerable.Repeat("[]", d - 1))}",
                "cpp" => "{}",
                "go" => "nil",
                "rust" => "Vec::new()",
                _ => "[]",
            };
            return b switch
            {
                "int" => "0",
                "double" => "0.0",
                "bool" => "false",
                _ => lang == "rust" ? "String::new()" : "\"\"",
            };
        }

        // ---- Starters ------------------------------------------------------------------

        public static Dictionary<string, string> Starters(ProblemSpec spec) =>
            Languages.ToDictionary(l => l, l => Starter(l, spec));

        public static string Starter(string lang, ProblemSpec spec)
        {
            var fn = FunctionName(lang, spec.FunctionName);
            var ps = spec.Params.Select(p => ParamName(lang, p)).ToList();
            var ret = spec.ReturnType;
            const string hint = "Return the answer. Check runs this against the tests.";
            string Typed(Func<string, string, string> render) => string.Join(", ", ps.Select((p, i) => render(p, TypeName(lang, spec.ParamTypes[i]))));

            return lang switch
            {
                "javascript" =>
                    $"function {fn}({string.Join(", ", ps)}) {{\n  // {hint}\n}}\n",
                "typescript" =>
                    $"function {fn}({Typed((p, t) => $"{p}: {t}")}): {TypeName(lang, ret)} {{\n  // {hint}\n  return {DefaultReturn(lang, ret)};\n}}\n",
                "python" =>
                    $"def {fn}({string.Join(", ", ps)}):\n    # {hint}\n    pass\n",
                "java" =>
                    $"import java.util.*;\n\n// Keep the class non-public and named Solution.\nclass Solution {{\n    public {TypeName(lang, ret)} {fn}({Typed((p, t) => $"{t} {p}")}) {{\n        // {hint}\n        return {DefaultReturn(lang, ret)};\n    }}\n}}\n",
                "csharp" =>
                    $"using System;\nusing System.Collections.Generic;\nusing System.Linq;\n\npublic class Solution {{\n    public {TypeName(lang, ret)} {fn}({Typed((p, t) => $"{t} {p}")}) {{\n        // {hint}\n        return {DefaultReturn(lang, ret)};\n    }}\n}}\n",
                "cpp" =>
                    $"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {{\npublic:\n    {TypeName(lang, ret)} {fn}({Typed((p, t) => t.StartsWith("vector") ? $"{t}& {p}" : $"{t} {p}")}) {{\n        // {hint}\n        return {DefaultReturn(lang, ret)};\n    }}\n}};\n",
                "go" =>
                    $"package main\n\nfunc {fn}({Typed((p, t) => $"{p} {t}")}) {TypeName(lang, ret)} {{\n\t// {hint}\n\treturn {DefaultReturn(lang, ret)}\n}}\n",
                "rust" =>
                    $"fn {fn}({Typed((p, t) => $"{p}: {t}")}) -> {TypeName(lang, ret)} {{\n    // {hint}\n    {DefaultReturn(lang, ret)}\n}}\n",
                _ => "",
            };
        }
    }
}

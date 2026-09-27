using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using MockMate.API.Models;
using MockMate.API.Services;
namespace MockMate.API.Hubs;

public class InterviewHub : Hub
{
    private readonly IAiService _aiService;
    private readonly ConversationStore _store;
    private readonly ILogger<InterviewHub> _logger;

    // Track which connections have ended their session (thread-safe set)
    private static readonly ConcurrentDictionary<string, byte> _endedSessions = new();

    public InterviewHub(IAiService aiService, ConversationStore store, ILogger<InterviewHub> logger)
    {
        _aiService = aiService;
        _store = store;
        _logger = logger;
    }

    public async Task ProcessUserAudio(UserInput input)
    {
        var connectionId = Context.ConnectionId;

        await Clients.Caller.SendAsync("ReceiveSystemStatus", "AI is thinking...");
        var response = await _aiService.GetResponseAsync(input, connectionId);

        // Only send if the session hasn't ended while we were waiting for Groq
        if (!_endedSessions.ContainsKey(connectionId))
        {
            await Clients.Caller.SendAsync("ReceiveAiResponse", response);
        }
    }

    public async Task<InterviewFeedback> EndSession()
    {
        var connectionId = Context.ConnectionId;

        // Mark this connection as ended BEFORE awaiting feedback
        _endedSessions.TryAdd(connectionId, 0);

        InterviewFeedback feedback;
        try
        {
            feedback = await _aiService.GenerateFeedbackAsync(connectionId);
        }
        catch (Exception ex)
        {
            // Keep the history so the client can call EndSession again.
            _logger.LogWarning(ex, "Report generation failed for {ConnectionId}", connectionId);
            throw new HubException("Report generation failed. Try again.");
        }

        // Done with this session: drop its history
        _store.Reset(connectionId);
        return feedback;
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        // Clean up when connection closes
        var connectionId = Context.ConnectionId;
        _endedSessions.TryRemove(connectionId, out _);
        _store.Reset(connectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
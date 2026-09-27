using MockMate.API.Models;

namespace MockMate.API.Services
{
    public interface IAiService
    {
        Task<AiResponse> GetResponseAsync(UserInput input, string sessionId);
        Task<InterviewFeedback> GenerateFeedbackAsync(string sessionId);

    }
}
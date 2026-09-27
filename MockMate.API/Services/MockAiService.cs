using MockMate.API.Models;

namespace MockMate.API.Services
{
    public class MockAiService : IAiService
    {
        public async Task<AiResponse> GetResponseAsync(UserInput input, string sessionId)
        {
            await Task.Delay(500);

            return new AiResponse
            {
                Message = $"I received your input: '{input.Text}'. Now, can you explain the time complexity of the code you just wrote?",
                IsCodeRequest = true
            };
        }

        public Task<InterviewFeedback> GenerateFeedbackAsync(string sessionId)
        {
            return Task.FromResult(new InterviewFeedback
            {
                CodingScore = 5,
                CommunicationScore = 5,
                FeedbackPoints = new List<string> { "This is a mock feedback." }
            });
        }

    }
}
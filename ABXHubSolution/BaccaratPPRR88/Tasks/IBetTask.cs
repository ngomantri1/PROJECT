using System.Threading;
using System.Threading.Tasks;
using BaccaratPPRR88.Tasks;

namespace BaccaratPPRR88.Tasks
{
    public interface IBetTask
    {
        string Id { get; }           // mã task
        string DisplayName { get; }  // tên hiển thị
        Task RunAsync(GameContext ctx, CancellationToken ct);
    }
}

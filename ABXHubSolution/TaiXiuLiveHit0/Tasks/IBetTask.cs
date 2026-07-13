using System.Threading;
using System.Threading.Tasks;
using TaiXiuLiveHit0.Tasks;

namespace TaiXiuLiveHit0.Tasks
{
    public interface IBetTask
    {
        string Id { get; }           // mã task
        string DisplayName { get; }  // tên hiển thị
        Task RunAsync(GameContext ctx, CancellationToken ct);
    }
}

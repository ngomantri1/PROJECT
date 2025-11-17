using System.Threading;
using System.Threading.Tasks;
using XocDiaLiveHit3.Tasks;

namespace XocDiaLiveHit3.Tasks
{
    public interface IBetTask
    {
        string Id { get; }           // mã task
        string DisplayName { get; }  // tên hiển thị
        Task RunAsync(GameContext ctx, CancellationToken ct);
    }
}

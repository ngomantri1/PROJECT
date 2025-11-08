using System.Threading;
using System.Threading.Tasks;
using XocDiaSoiLiveKH24.Tasks;

namespace XocDiaSoiLiveKH24.Tasks
{
    public interface IBetTask
    {
        string Id { get; }           // mã task
        string DisplayName { get; }  // tên hiển thị
        Task RunAsync(GameContext ctx, CancellationToken ct);
    }
}

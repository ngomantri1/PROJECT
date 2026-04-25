using System.Threading;
using System.Threading.Tasks;
using XocDiaB52.Tasks;

namespace XocDiaB52.Tasks
{
    public interface IBetTask
    {
        string Id { get; }           // mã task
        string DisplayName { get; }  // tên hiển thị
        Task RunAsync(GameContext ctx, CancellationToken ct);
    }
}

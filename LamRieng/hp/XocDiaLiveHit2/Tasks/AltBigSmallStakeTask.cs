using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Controls.Primitives;

namespace XocDiaLiveHit2.Tasks
{
    /// <summary>
    /// Cách chơi: khi thua thì luân phiên chọn cửa có tổng LỚN/BÉ; thắng thì về bước 1.
    /// Chính là B5 bạn đưa – tách ra thành Task riêng.
    /// </summary>
    public sealed class AltBigSmallStakeTask : IBetTask
    {
        public string Id => "alt-big-small";
        public string DisplayName => "Luân phiên LỚN/BÉ theo chuỗi tiền";
        private volatile bool _isNewRoundModeEnabled = true;
        private volatile bool _isBettingAllowed = true;
        private double amount = 0;

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            ctx.Log("[DEC] loop started (" + DisplayName + ")");

            while (!ct.IsCancellationRequested)
            {
                var snap = ctx.GetSnap?.Invoke();

                if (snap == null || !snap.prog.HasValue || snap.totals == null)
                {
                    await Task.Delay(80, ct);
                    continue;
                }

                if (snap.prog.Value > 0.8)
                {
                    if (_isNewRoundModeEnabled == true)
                    {
                        ctx.State.PreviousBetSide = ctx.State.CurrentBetSide;
                        // Set kết quả hiện tại
                        var kq = snap.seq[49];
                        if (kq == '0' || kq == '2' || kq == '4')
                        {
                            ctx.State.CurrentOutcome = "CHAN";
                        }
                        else if (kq == '1' || kq == '3') ctx.State.CurrentOutcome = "LE";
                        else ctx.State.CurrentOutcome = null;

                        // ====== XÁC ĐỊNH THẮNG/THUA ======
                        if (ctx.State.PreviousBetSide == ctx.State.CurrentOutcome || ctx.State.PreviousBetSide == null)
                        {
                            ctx.State.Step = 0;
                            ctx.State.PreferLarger = true; // quay về LẦN 1
                            ctx.State.LastWin = true;
                            //ctx.State.PreferLarger = !ctx.State.PreferLarger; // đảo LỚN/BÉ
                            //ctx.Log("[DEC] WIN -> reset to step1, prefer=LỚN");
                            ctx.UiAddWin?.Invoke(amount*0.98);

                        }
                        else if (ctx.State.PreviousBetSide != ctx.State.CurrentOutcome && ctx.State.PreviousBetSide != null)
                        {
                            ctx.State.Step = (ctx.State.Step + 1) % Math.Max(1, ctx.StakeSeq.Length);
                            ctx.State.PreferLarger = true;
                            //ctx.State.PreferLarger = !ctx.State.PreferLarger; // đảo LỚN/BÉ
                            ctx.State.LastWin = false;
                            //ctx.Log("[DEC] LOSE -> next step=" + (ctx.State.Step + 1) + ", prefer=" + (ctx.State.PreferLarger ? "LỚN" : "BÉ"));
                            ctx.UiAddWin?.Invoke(-amount);
                        }
                        else
                        {
                            // Không xác định được kết quả: giữ nguyên step
                            ctx.Log("[DEC] chưa xác định kết quả vòng vừa rồi, giữ step");
                        }
                        var step = Math.Clamp(ctx.State.Step, 0, Math.Max(0, ctx.StakeSeq.Length - 1));
                        amount = ctx.StakeSeq.Length > 0 ? ctx.StakeSeq[step] : 1000L;
                        ctx.UiSetStake?.Invoke(amount);
                        if (ctx.State.PreviousBetSide != null)
                        {
                            ctx.UiWinLoss?.Invoke(ctx.State.LastWin);
                        }
                        _isNewRoundModeEnabled = false;
                    }
                    else
                    {
                        await Task.Delay(80, ct);
                        continue;
                    }


                }
                if (snap.prog.Value <= 0)
                {
                    _isNewRoundModeEnabled = true;
                    _isBettingAllowed = true;
                }

                // Chặn bắn trùng khi vừa đặt
                if (ctx.GetCooldown?.Invoke() == true)
                {
                    await Task.Delay(50, ct);
                    continue;
                }
                if (snap.prog.Value < ctx.DecisionPercent && snap.prog.Value > 0.1 && _isBettingAllowed == true)
                {

                    // Xác định cửa theo LỚN/BÉ
                    long c = snap.totals.C ?? 0;
                    long l = snap.totals.L ?? 0;

                    if (ctx.State.PreferLarger)
                        ctx.State.CurrentBetSide = (c >= l) ? "CHAN" : "LE";
                    else
                        ctx.State.CurrentBetSide = (c <= l) ? "CHAN" : "LE";
                    // Bắn lệnh cược xuống JS
                    ctx.SetCooldown?.Invoke(true);
                    ctx.Log($"[DEC] step={ctx.State.Step + 1}/{ctx.StakeSeq.Length}, prefer={(ctx.State.PreferLarger ? "LỚN" : "BÉ")}, side={ctx.State.CurrentBetSide}, amount={amount}");
                    _isBettingAllowed = false;
                    try
                    {
                        var js = $"(async()=>{{ try{{ return await window.__cw_bet('{ctx.State.CurrentBetSide}', {amount}); }}catch(e){{ return 'ERR:'+String(e); }} }})()";
                        var ret = await ctx.EvalJsAsync(js);
                        ctx.Log("[DEC] __cw_bet => " + ret);
                        // Gắn về UI
                        ctx.UiSetSide?.Invoke(ctx.State.CurrentBetSide);

                    }
                    catch (Exception ex)
                    {
                        ctx.Log("[DEC][ERR] " + ex.Message);
                    }
                    finally
                    {
                        // Cooldown ngắn tránh double-fire
                        _ = Task.Run(async () =>
                        {
                            try { await Task.Delay(700, ct); } catch { }
                            ctx.SetCooldown?.Invoke(false);
                        }, ct);
                    }
                }





                await Task.Delay(80, ct);
            }

            ctx.Log("[DEC] loop stopped (" + DisplayName + ")");
        }

        // TODO: thay bằng logic đọc kết quả thật sự từ JS
        //private async Task<bool?> TryInferWinLossAsync(GameContext ctx, string sideBet, CancellationToken ct)
        //{
        //    var t0 = DateTime.UtcNow;
        //    double? lastProg = null;

        //    while ((DateTime.UtcNow - t0).TotalMilliseconds < 3000 && !ct.IsCancellationRequested)
        //    {
        //        var s = ctx.GetSnap?.Invoke();
        //        if (s != null && s.prog.HasValue)
        //        {
        //            if (lastProg.HasValue && s.prog.Value > lastProg.Value + 0.3)
        //                break; // vòng mới đã bắt đầu
        //            lastProg = s.prog;
        //        }
        //        try { await Task.Delay(120, ct); } catch { break; }
        //    }

        //    // Khuyến nghị: thay bằng đọc "cửa thắng" từ label/JS postMessage {abx:'round', winSide:...}
        //    return null;
        //}
    }
}

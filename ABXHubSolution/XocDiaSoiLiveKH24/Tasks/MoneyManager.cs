using System;

namespace XocDiaSoiLiveKH24.Tasks
{
    /// <summary>Ði?u ph?i m?c ti?n theo 4 ki?u qu?n lý v?n.</summary>
    internal sealed class MoneyManager
    {
        private readonly long[] _seq;
        private readonly string _id;
        private int _i;                       // index hi?n t?i (0-based)
        private bool _needDoubleNext;         // Victor2: v?a th?ng xong ? ván t?i g?p dôi
        private bool _usedDoubleThisRound;    // Victor2: ván v?a cu?c có g?p dôi hay không

        public MoneyManager(long[] seq, string id)
        {
            _seq = (seq != null && seq.Length > 0) ? seq : new long[] { 1000 };
            _id = string.IsNullOrWhiteSpace(id) ? "IncreaseWhenLose" : id;
            _i = 0;
        }

        public long CurrentUnit => _seq[Math.Clamp(_i, 0, _seq.Length - 1)];

        /// <summary>Ti?n s? d?t ? VÁN S?P CU?C (có xét g?p dôi v?i Victor2).</summary>
        public long GetStakeForThisBet()
        {
            if (_id == "Victor2" && _needDoubleNext)
            {
                _usedDoubleThisRound = true;
                return CurrentUnit * 2;
            }
            _usedDoubleThisRound = false;
            return CurrentUnit;
        }

        /// <summary>G?i sau khi có k?t qu? WIN/LOSS (true/false).</summary>
        public void OnRoundResult(bool win)
        {
            switch (_id)
            {
                case "IncreaseWhenLose":   // thua ?1 m?c, th?ng ? v? m?c 1
                    _needDoubleNext = false;
                    _i = win ? 0 : (_i + 1 < _seq.Length ? _i + 1 : 0);
                    break;

                case "IncreaseWhenWin":    // th?ng ?1 m?c, thua ? v? m?c 1
                    _needDoubleNext = false;
                    _i = win ? (_i + 1 < _seq.Length ? _i + 1 : 0) : 0;
                    break;

                case "Victor2":
                    if (win)
                    {
                        if (_usedDoubleThisRound)
                        {
                            // Th?ng v?i m?c g?p dôi ? quay v? m?c 1
                            _i = 0;
                            _needDoubleNext = false;
                        }
                        else
                        {
                            // Th?ng l?n d?u n?u dang m?c 1 thì quay v? m?c 1 không g?p dôi, còn t? m?c 2 tr? di ? ván t?i g?p dôi cùng “b?c”
                            if (_i == 0)
                            {
                                _i = 0;
                                _needDoubleNext = false;
                            }
                            else _needDoubleNext = true;
                        }
                    }
                    else
                    {
                        // Thua ? lên b?c ti?p theo, h?t b?c thì v? 1
                        _needDoubleNext = false;
                        _i = (_i + 1 < _seq.Length ? _i + 1 : 0);
                    }
                    break;

                case "ReverseFibo":        // thua ?1 m?c (d?n m?c cao nh?t thì gi? nguyên), th?ng ? v? m?c 1
                    _needDoubleNext = false;
                    _i = win ? 0 : Math.Min(_i + 1, _seq.Length - 1);
                    break;
                case "WinUpLoseKeep":
                    {
                        _needDoubleNext = false; // kh“ng d—ng Victor2 ? strategy n…y

                        if (win)
                        {
                            var before = _i;

                            // th?ng => tang m?c
                            _i = (_i + 1 < _seq.Length ? _i + 1 : 0);
                            MoneyHelper.Logger?.Invoke($"[S7] MoneyManager: WIN => step {before} -> {_i}");

                            // sau khi th?ng: n?u total t?m da duong => reset level 1 v… reset t?ng t?m
                            if (MoneyHelper.ConsumeS7ResetFlag())
                            {
                                _i = 0;
                                MoneyHelper.Logger?.Invoke($"[S7] MoneyManager: _s7TempNetDelta>0 => reset step -> 0");
                            }
                        }
                        else
                        {
                            // thua => gi? nguyˆn m?c
                            MoneyHelper.Logger?.Invoke($"[S7] MoneyManager: LOSS => keep step={_i}");
                        }

                        break;
                    }
            }
        }
    }
}

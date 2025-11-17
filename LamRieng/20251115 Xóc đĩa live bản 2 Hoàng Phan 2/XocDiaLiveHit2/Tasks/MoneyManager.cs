using System;

namespace XocDiaLiveHit2.Tasks
{
    /// <summary>Điều phối mức tiền theo 4 kiểu quản lý vốn.</summary>
    internal sealed class MoneyManager
    {
        private readonly long[] _seq;
        private readonly string _id;
        private int _i;                       // index hiện tại (0-based)
        private bool _needDoubleNext;         // Victor2: vừa thắng xong → ván tới gấp đôi
        private bool _usedDoubleThisRound;    // Victor2: ván vừa cược có gấp đôi hay không

        public MoneyManager(long[] seq, string id)
        {
            _seq = (seq != null && seq.Length > 0) ? seq : new long[] { 1000 };
            _id = string.IsNullOrWhiteSpace(id) ? "IncreaseWhenLose" : id;
            _i = 0;
        }

        public long CurrentUnit => _seq[Math.Clamp(_i, 0, _seq.Length - 1)];

        /// <summary>Tiền sẽ đặt ở VÁN SẮP CƯỢC (có xét gấp đôi với Victor2).</summary>
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

        /// <summary>Gọi sau khi có kết quả WIN/LOSS (true/false).</summary>
        public void OnRoundResult(bool win)
        {
            switch (_id)
            {
                case "IncreaseWhenLose":   // thua ↑1 mức, thắng → về mức 1
                    _needDoubleNext = false;
                    _i = win ? 0 : (_i + 1 < _seq.Length ? _i + 1 : 0);
                    break;

                case "IncreaseWhenWin":    // thắng ↑1 mức, thua → về mức 1
                    _needDoubleNext = false;
                    _i = win ? (_i + 1 < _seq.Length ? _i + 1 : 0) : 0;
                    break;

                case "Victor2":
                    if (win)
                    {
                        if (_usedDoubleThisRound)
                        {
                            // Thắng với mức gấp đôi → quay về mức 1
                            _i = 0;
                            _needDoubleNext = false;
                        }
                        else
                        {
                            // Thắng lần đầu nếu đang mức 1 thì quay về mức 1 không gấp đôi, còn từ mức 2 trở đi → ván tới gấp đôi cùng “bậc”
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
                        // Thua → lên bậc tiếp theo, hết bậc thì về 1
                        _needDoubleNext = false;
                        _i = (_i + 1 < _seq.Length ? _i + 1 : 0);
                    }
                    break;

                case "ReverseFibo":        // thua ↑1 mức (đến mức cao nhất thì giữ nguyên), thắng → về mức 1
                    _needDoubleNext = false;
                    _i = win ? 0 : Math.Min(_i + 1, _seq.Length - 1);
                    break;
            }
        }
    }
}

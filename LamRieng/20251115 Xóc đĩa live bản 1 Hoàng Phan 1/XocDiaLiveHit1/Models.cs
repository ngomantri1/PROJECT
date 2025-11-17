using System;
using System.Windows.Media;
using XocDiaLiveHit1;

namespace XocDiaLiveHit1
{
    public sealed class CwTotals
    {
        public long? C { get; set; }
        public long? L { get; set; }
        public long? A { get; set; }
        public long? SD { get; set; }
        public long? TT { get; set; }
        public long? T3T { get; set; }
        public long? T3D { get; set; }
        public long? TD { get; set; }
    }

    public sealed class CwSnapshot
    {
        public string abx { get; set; }
        public double? prog { get; set; }
        public CwTotals totals { get; set; }
        public string seq { get; set; }
        public string? niSeq { get; set; }
        public long ts { get; set; }
        public string side { get; set; }
        public long? amount { get; set; }
        public string error { get; set; }
    }

    public sealed class DecisionState
    {
        public int Step = 0;              // index chuỗi tiền (0-based)
        public bool PreferLarger = true;  // true: chọn cửa tổng LỚN; false: tổng BÉ
        public bool LastWin = false;
        public string? PreviousBetSide = null; // "CHAN"|"LE"
        public string? CurrentBetSide = null; // "CHAN"|"LE"
        public string? CurrentOutcome = null; // "CHAN"|"LE"
        public int MoneyChainIndex { get; set; }      // đang ở chuỗi thứ mấy (0-based)
        public int MoneyChainStep { get; set; }       // đang ở mức thứ mấy trong chuỗi đó (0-based)
        public long MoneyChainProfit { get; set; }    // tiền đã gom được ở chuỗi hiện tại

    }

}

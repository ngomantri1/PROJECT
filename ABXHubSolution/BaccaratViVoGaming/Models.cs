using System;
using System.Windows.Media;
using BaccaratViVoGaming;

namespace BaccaratViVoGaming
{
    public sealed class CwTotals
    {
        public long? B { get; set; }
        public long? P { get; set; }
        public long? T { get; set; }
        public double? A { get; set; }
        public string AS { get; set; }
        public string N { get; set; }
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
        public int? progValid { get; set; }
        public string? progMode { get; set; }
        public double? progRaw { get; set; }
        public string? progSource { get; set; }
        public string? progTail { get; set; }
        public CwTotals totals { get; set; }
        public string seq { get; set; }
        public string rawSeq { get; set; }
        public long? seqVersion { get; set; }
        public string seqEvent { get; set; }
        public string? seqSource { get; set; }
        public string? seqAppend { get; set; }
        public string? seqMode { get; set; }
        public long? boardCountB { get; set; }
        public long? boardCountP { get; set; }
        public long? boardCountT { get; set; }
        public string? boardCountSource { get; set; }
        public string? niSeq { get; set; }
        public long ts { get; set; }
        public string side { get; set; }
        public long? amount { get; set; }
        public string error { get; set; }
        public string session { get; set; }
        public string username { get; set; }
        public string status { get; set; }
        public string? statusSource { get; set; }
        public string? statusTail { get; set; }
        public long? jsBuildMs { get; set; }
        public long? jsProgMs { get; set; }
        public long? jsTotalsMs { get; set; }
        public long? jsSeqMs { get; set; }
        public int? jsPerfMode { get; set; }
    }

    public sealed class DecisionState
    {
        public int Step = 0;              // index chuỗi tiền (0-based)
        public bool PreferLarger = true;  // true: chọn cửa tổng LỚN; false: tổng BÉ
        public bool LastWin = false;
        public string? PreviousBetSide = null; // "BANKER"|"PLAYER"
        public string? CurrentBetSide = null; // "BANKER"|"PLAYER"
        public string? CurrentOutcome = null; // "BANKER"|"PLAYER"
        public int MoneyChainIndex { get; set; }      // đang ở chuỗi thứ mấy (0-based)
        public int MoneyChainStep { get; set; }       // đang ở mức thứ mấy trong chuỗi đó (0-based)
        public long MoneyChainProfit { get; set; }    // tiền đã gom được ở chuỗi hiện tại

    }

}



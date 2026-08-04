using System.Reflection;
using System.Text.Json;
using BaccaratSexyCasino2;

record StrategyCase(string id, string strategy_id, string history, string manager_id, long[] stakes, string[] results, int schedule_index = 0);
record StrategyFile(int version, List<StrategyCase> cases);

static class Program
{
    static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true, WriteIndented = true };
    static readonly Assembly Reference = typeof(MainWindow).Assembly;
    const BindingFlags HiddenStatic = BindingFlags.NonPublic | BindingFlags.Static;
    const BindingFlags HiddenInstance = BindingFlags.NonPublic | BindingFlags.Instance;

    static Type TaskType(string name) => Reference.GetType($"BaccaratSexyCasino2.Tasks.{name}", true)!;
    static MethodInfo Hidden(Type type, string name, BindingFlags flags) => type.GetMethod(name, flags) ?? throw new MissingMethodException(type.FullName, name);
    static char SideChar(object value) => value switch
    {
        char side => side,
        string side when side.Equals("BANKER", StringComparison.OrdinalIgnoreCase) => 'B',
        string side when side.Equals("PLAYER", StringComparison.OrdinalIgnoreCase) => 'P',
        _ => throw new InvalidOperationException($"Unsupported side value: {value}")
    };

    static char Decide(string strategyId, string history, int scheduleIndex)
    {
        object result;
        switch (strategyId)
        {
            case "smart_prev":
                result = Hidden(TaskType("SmartPrevTask"), "DecideNextSide", HiddenStatic).Invoke(null, new object[] { history })!;
                break;
            case "smart_prev_advanced":
                result = Hidden(TaskType("SmartPrevAdvancedTask"), "DecideNextSide", HiddenStatic).Invoke(null, new object[] { history })!;
                break;
            case "ai_stat_parity":
                var tuple = Hidden(TaskType("AiStatParityTask"), "PredictNextWithConfidence", HiddenStatic).Invoke(null, new object[] { history, 6 })!;
                result = tuple.GetType().GetField("Item1")!.GetValue(tuple)!;
                break;
            case "state_transition":
                result = Hidden(TaskType("StateTransitionBiasTask"), "DecideNext", HiddenStatic).Invoke(null, new object[] { history.Length == 0 ? 'B' : history[^1], history })!;
                break;
            case "run_length":
                result = Hidden(TaskType("RunLengthBiasTask"), "DecideNext", HiddenStatic).Invoke(null, new object[] { history })!;
                break;
            case "knn_subsequence":
                result = Hidden(TaskType("KnnSubsequenceTask"), "Decide", HiddenStatic).Invoke(null, new object[] { history })!;
                break;
            case "time_sliced_hedge":
            case "dual_schedule_hedge":
                var type = TaskType(strategyId == "time_sliced_hedge" ? "TimeSlicedHedgeTask" : "DualScheduleHedgeTask");
                var task = Activator.CreateInstance(type)!;
                type.GetField("_roundInBlock", HiddenInstance)!.SetValue(task, scheduleIndex);
                result = Hidden(type, "Decide", HiddenInstance).Invoke(task, new object[] { history })!;
                break;
            default:
                throw new InvalidOperationException($"Unsupported strategy: {strategyId}");
        }
        return SideChar(result);
    }

    static bool? Win(char side, char result) => result == 'T' ? null : side == result;
    static double Pnl(char side, long stake, bool? win) => win switch
    {
        null => 0,
        false => -stake,
        _ when side == 'B' => Math.Round(stake * .95, 0, MidpointRounding.AwayFromZero),
        _ => stake,
    };

    static List<object> Run(StrategyCase vector)
    {
        var moneyType = TaskType("MoneyManager");
        var money = Activator.CreateInstance(moneyType, new object[] { vector.stakes, vector.manager_id })!;
        var getStake = moneyType.GetMethod("GetStakeForThisBet")!;
        var onResult = moneyType.GetMethod("OnRoundResult")!;
        var levelField = moneyType.GetField("_i", HiddenInstance)!;
        var history = new string(vector.history.Where(value => value is 'B' or 'P').ToArray());
        var scheduleIndex = ((vector.schedule_index % 10) + 10) % 10;
        var rows = new List<object>();
        for (var index = 0; index < vector.results.Length; index++)
        {
            var side = Decide(vector.strategy_id, history, scheduleIndex);
            var result = vector.results[index][0];
            var stake = (long)getStake.Invoke(money, null)!;
            var win = Win(side, result);
            var pnl = Pnl(side, stake, win);
            onResult.Invoke(money, new object?[] { win });
            var nextStake = (long)getStake.Invoke(money, null)!;
            rows.Add(new { round = index + 1, side = side.ToString(), result = result.ToString(), stake, pnl,
                level_index = (int)levelField.GetValue(money)!, next_stake = nextStake, schedule_index = scheduleIndex });
            if (result is 'B' or 'P') history += result;
            if (vector.strategy_id is "time_sliced_hedge" or "dual_schedule_hedge") scheduleIndex = (scheduleIndex + 1) % 10;
        }
        return rows;
    }

    static int Main(string[] args)
    {
        if (args.Length != 1) { Console.Error.WriteLine("Usage: StrategyGolden <strategy_cases.json>"); return 2; }
        var vectors = JsonSerializer.Deserialize<StrategyFile>(File.ReadAllText(args[0]), Json)!;
        Console.WriteLine(JsonSerializer.Serialize(vectors.cases.ToDictionary(item => item.id, Run), Json));
        return 0;
    }
}

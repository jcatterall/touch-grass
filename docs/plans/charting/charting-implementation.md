Absolutely! Here’s a **dedicated architectural plan for charting in TouchGrass**, built on top of the metrics layer we already defined. This focuses purely on **how to consume metrics for charts**, **data access patterns**, and **performance considerations** — independent of UI frameworks or specific chart libraries.

---

# 📊 Charting Layer Plan: TouchGrass

---

## 1️⃣ Objectives

* Build a **scalable charting layer** using the existing metrics.
* Ensure **fast, reactive updates** for charts without recalculating large datasets.
* Maintain **separation of concerns**: charting logic does not alter metrics.
* Prepare for **future analytics** and cloud-sync visualization.
* Handle **historical ranges** (daily, weekly, monthly) efficiently.

---

## 2️⃣ Data Sources

Charts will use **pre-aggregated metrics** from MMKV:

| Metric Source                | Description                                                                       |       |                                                       |
| ---------------------------- | --------------------------------------------------------------------------------- | ----- | ----------------------------------------------------- |
| `metrics:daily:YYYY-MM-DD`   | Base daily snapshot for line/bar charts, streaks, and comparisons.                |       |                                                       |
| `metrics:rolling:7d          | 30d                                                                               | 365d` | Precomputed aggregates for quick dashboard summaries. |
| `metrics:monthly:YYYY-MM`    | Long-term summaries for annual or monthly charts.                                 |       |                                                       |
| `event:timestamp` (optional) | Append-only events for activity heatmaps, unlock trends, or time-of-day patterns. |       |                                                       |

**Note:** Charts **never directly modify MMKV**; they only read snapshots or aggregates.

---

## 3️⃣ Key Chart Types (Data-Oriented)

These chart types are examples of what can be built **once metrics are available**:

1. **Daily Activity Trend**

   * Source: `metrics:daily`
   * Data: distanceMeters, elapsedSeconds per day
   * Use: bar or line charts to show progress over time

2. **Focus Time Trend**

   * Source: `metrics:daily`
   * Data: focusMinutes
   * Use: line chart, stacked bar, or weekly aggregate comparison

3. **Goal Achievement Streak**

   * Source: `metrics:daily`
   * Data: goalsReached
   * Use: calendar heatmaps or streak counters

4. **Blocked App Attempts Trend**

   * Source: `metrics:daily` or `event:timestamp`
   * Data: blockedAttempts / unlockEvents
   * Use: line chart for user adherence analytics

5. **Monthly Summaries**

   * Source: `metrics:monthly`
   * Data: aggregate totals of distance, focusMinutes, goalsReached
   * Use: dashboard cards, annual overview charts

6. **Optional Future Insights**

   * Source: `event:timestamp`
   * Data: time-of-day patterns, unlock behavior, app-specific trends
   * Use: heatmaps or scatter plots for deeper analytics

---

## 4️⃣ Data Access Patterns

### **A. Daily & Weekly Charts**

* Query `metrics:index:daily` for the date range.
* Fetch only the relevant `metrics:daily:YYYY-MM-DD` entries.
* Aggregate on-demand if required (e.g., weekly sum of distance or focusMinutes).

### **B. Rolling Aggregates**

* Use `metrics:rolling:7d|30d` for summaries to **avoid iterating all daily metrics**.
* Example: Display “last 7 days” total distance instantly.

### **C. Monthly Charts**

* Query `metrics:monthly:YYYY-MM` for long-term trends.
* Avoid reading all daily snapshots for historical months.

### **D. Event-Based Charts**

* Read `event:timestamp` selectively based on the **time range**.
* Consider storing events in **time-bucketed structures** for fast querying (e.g., `event:YYYY-MM-DD-HH`).

---

## 5️⃣ Performance Considerations

1. **Read-only charts**: never write to MMKV during chart rendering.
2. **Pre-aggregation first**: use rolling or monthly aggregates instead of calculating sums from raw daily metrics.
3. **Memoization / caching**: cache derived datasets for visible chart ranges to reduce recomputation on re-renders.
4. **Date indexing**: leverage `metrics:index:daily` for fast lookup of daily keys.
5. **Pagination / lazy loading**: for very long timelines (6–12 months), load in chunks to avoid large memory spikes.
6. **Debounce UI updates**: if reading live metrics (for real-time progress charts), debounce updates to 1–2 seconds.
7. **Immutable data objects**: ensure chart components receive immutable snapshots to enable efficient React reconciliation.

---

## 6️⃣ Working with the Data Layer

### **Best Practices**

* **Selectors:** Create pure selectors that convert raw daily/rolling metrics into chart-ready data structures.
* **Derived Metrics:** Calculate derived values (e.g., daily completion percentage) outside MMKV to keep storage simple.
* **Timezone Safety:** Always normalize dates to local device timezone.
* **Consistency:** Align rolling aggregates with daily snapshots to prevent mismatched totals in charts.
* **Unit Handling:** Keep units consistent across charts (meters vs. km, seconds vs. minutes).

---

## 7️⃣ Future-Proofing

* **Cloud Sync Integration:** Charts can work with synced metrics without altering the structure.
* **Event Analytics:** Event logs enable new chart types without redesigning daily metrics.
* **Predictive Insights:** Once ML models are introduced, pre-aggregated metrics can feed AI-generated charts efficiently.

---

## 8️⃣ Developer Workflow Recommendations

1. **Data-first approach:** Always fetch data from metrics snapshots before building charts.
2. **Immutable transformations:** Transform data into chart-friendly format without altering MMKV.
3. **React memoization:** Use React `useMemo` or Redux selectors to prevent unnecessary recalculations.
4. **Batch updates:** For real-time charts, batch metrics updates to reduce render frequency.
5. **Testing edge cases:**

   * Midnight rollover
   * Plan changes mid-day
   * Sparse or missing daily data
   * Timezone changes

---

## 9️⃣ Summary

* **Metrics layer provides all the necessary data** for charts, without coupling chart logic to storage.
* **Charts read snapshots**: daily, rolling, monthly, and event logs.
* **Performance strategy**: pre-aggregates, memoization, and selective queries.
* **Future-ready**: supports cloud sync, advanced analytics, and AI insights.
* **Separation of concerns** ensures charting can evolve independently of storage or tracking logic.

---

If you want, I can also **provide a sample TypeScript “metrics-to-chart” utility layer** showing how to:

* Query MMKV metrics
* Build chart-ready datasets for any date range
* Handle rolling aggregates efficiently

This would give you a **ready-to-use abstraction** for all future charting work.

Do you want me to create that next?

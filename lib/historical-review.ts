export type HistoricalReviewRow={campusName:string;region:string;page:number;attendance:Record<2023|2024,number|null>;prayerHours:Record<2023|2024,number|null>;evangelismHours:Record<2023|2024,number|null>};
export type HistoricalReviewOverall={metric:string;unit:string;2023:string;2024:string;page:number};
export type HistoricalAttendancePoint={week:string;2023:number;2024:number};
export type HistoricalReviewData={rows:HistoricalReviewRow[];overall:HistoricalReviewOverall[];attendanceTrend:HistoricalAttendancePoint[]};
export const historicalReviewNote='Source: KOC REVIEW Analytics dashboard 2.pdf, regional review tables on pages 5–10. Values are average per week as labelled 2023 and 2024. Complete academic-year dates and the number of submitted weeks are not specified. Blank source cells remain unknown. These historical figures are separate from live reporting totals and include campuses that may now be inactive.';

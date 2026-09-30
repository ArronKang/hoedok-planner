// 화면 이름 → 컴포넌트
import { DayView } from './today/DayView.js';
import { CalendarView } from './calendar/CalendarView.js';
import { ExamsView } from './exams/ExamsView.js';
import { ExamDetail } from './exams/ExamDetail.js';
import { TrackView } from './exams/TrackView.js';
import { ProgressView } from './exams/ProgressView.js';
import { GradesView } from './grades/GradesView.js';
import { NaesinRecordView } from './grades/NaesinRecord.js';
import { MockExamView } from './grades/MockExam.js';
import { AnalysisView } from './analysis/AnalysisView.js';

export const VIEWS = {
  today: DayView,
  calendar: CalendarView,
  exams: ExamsView,
  exam: ExamDetail,
  track: TrackView,
  progress: ProgressView,
  grades: GradesView,
  naesin: NaesinRecordView,
  mockExam: MockExamView,
  analysis: AnalysisView,
};

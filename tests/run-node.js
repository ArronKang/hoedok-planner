// 노드에서 테스트 실행: powershell -File tools/node.ps1 tests/run-node.js [필터]
import { run } from './harness.js';
import { UNIT_TESTS, NODE_TESTS } from './list.js';

for (const f of [...UNIT_TESTS, ...NODE_TESTS]) await import(f);
const { fail } = await run((s) => console.log(s), process.argv[2]);
process.exit(fail ? 1 : 0); // 알림 타이머가 남아 있어도 바로 끝낸다

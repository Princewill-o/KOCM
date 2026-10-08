// @vitest-environment jsdom
import {createElement} from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
const api=vi.hoisted(()=>({listNotifications:vi.fn(),acknowledgeNotification:vi.fn()}));
vi.mock('../lib/platform',()=>api);
import Notifications from '../app/views/notifications';
afterEach(cleanup);
it('labels missing reporting alerts correctly and opens their scoped reporting week',async()=>{api.listNotifications.mockResolvedValue([{id:'missing',kind:'missing_report',title:'Weekly report not submitted',message:'London is missing.',campus_id:null,reporting_scope:'cluster',reporting_scope_id:'london',reporting_week:'2026-10-09',created_at:'2026-10-09T22:00:00Z',read_at:null,resolved_at:null}]);const open=vi.fn();render(createElement(Notifications,{onOpenReporting:open}));await screen.findByText('MISSING REPORT');expect(screen.queryByText('LATE REPORT')).toBeNull();fireEvent.click(screen.getByText('Open weekly report'));expect(open).toHaveBeenCalledWith('cluster','london','2026-10-09');});
it('shows resolved alerts without prompting another report submission',async()=>{api.listNotifications.mockResolvedValue([{id:'resolved',kind:'report_reminder',title:'Resolved — report reminder',message:'No longer outstanding.',campus_id:'campus',created_at:'2026-10-09T19:00:00Z',read_at:'2026-10-09T20:00:00Z',resolved_at:'2026-10-09T20:00:00Z'}]);render(createElement(Notifications,{onOpenReporting:vi.fn()}));await screen.findByText('REPORT REMINDER');expect(screen.getByText(/Resolved — this report/)).toBeTruthy();expect(screen.queryByText('Open weekly report')).toBeNull();});

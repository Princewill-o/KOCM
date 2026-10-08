// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClusterReportForm from '../app/views/cluster-report-form';
import type { Profile } from '../lib/koc';
const api = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock('../lib/cluster-reports', () => ({ submitClusterReport: api.submit }));
beforeEach(() => api.submit.mockReset());
afterEach(cleanup);
const profile = { full_name: 'Test Lead', cluster_id: 'cluster-a', role: 'cluster' } as Profile;
const campuses = [{ id: 'own-campus', name: 'Own University', region: 'London', cluster_id: 'cluster-a' }, { id: 'other-campus', name: 'Other University', region: 'North', cluster_id: 'cluster-b' }];
it('reviews and submits the chosen reporting week',async()=>{
 api.submit.mockResolvedValue({id:'week-report',created_at:'2026-10-08T10:00:00Z'});
 render(createElement(ClusterReportForm,{profile,campuses,initialWeek:'2026-09-25',season:{id:'2026-2027',name:'2026–2027',start_date:'2026-09-18',end_date:'2027-05-28',deadline_hour:22,time_zone:'Europe/London'}}));
 expect((screen.getByLabelText('Reporting week *') as unknown as HTMLSelectElement).value).toBe('2026-09-25');
 fireEvent.click(screen.getByLabelText('Incident'));
 fireEvent.change(screen.getByLabelText('Do you want to report any other issues regarding KOC? *'),{target:{value:'no'}});
 fireEvent.click(screen.getByRole('button',{name:'Review answers'}));
 fireEvent.click(screen.getByRole('button',{name:'Submit report'}));
 await screen.findByText('Report submitted');
 expect(api.submit.mock.calls[0][2]).toBe('2026-09-25');
});
it('shows only assigned campuses and does not send answers until explicit submission', () => {
  const { container } = render(createElement(ClusterReportForm, { profile, campuses }));
  expect(screen.queryByRole('option', { name: 'Other University' })).toBeNull();
  expect(container.querySelector('[type="submit"]')).toBeNull();
  fireEvent.click(screen.getByLabelText('Incident'));
  fireEvent.change(screen.getByLabelText('Do you want to report any other issues regarding KOC? *'), { target: { value: 'no' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review answers' }));
  expect(screen.getByRole('button', { name: 'Submit report' })).toBeTruthy();
  expect(api.submit).not.toHaveBeenCalled();
});
it('clears hidden sensitive answers when the parent decision changes', () => {
  render(createElement(ClusterReportForm, { profile, campuses }));
  fireEvent.click(screen.getByLabelText('Incident'));
  const gate = screen.getByLabelText('Do you want to report any other issues regarding KOC? *');
  fireEvent.change(gate, { target: { value: 'yes' } });
  fireEvent.change(screen.getByLabelText('Describe the incident *'), { target: { value: 'Old private information' } });
  fireEvent.change(gate, { target: { value: 'no' } });
  expect(screen.queryByLabelText('Describe the incident *')).toBeNull();
  fireEvent.change(gate, { target: { value: 'yes' } });
  expect((screen.getByLabelText('Describe the incident *') as HTMLTextAreaElement).value).toBe('');
});
it('resets answers when reporting scope changes', () => {
  render(createElement(ClusterReportForm, { profile, campuses }));
  fireEvent.click(screen.getByLabelText('Incident'));
  fireEvent.change(screen.getByLabelText('Do you want to report any other issues regarding KOC? *'), { target: { value: 'yes' } });
  fireEvent.change(screen.getByLabelText('Describe the incident *'), { target: { value: 'Old scope information' } });
  fireEvent.change(screen.getByLabelText('Report scope *'), { target: { value: 'campus' } });
  expect(screen.queryByLabelText('Describe the incident *')).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.getByLabelText('Do you want to report on KOC Session? *')).toBeTruthy();
  expect((screen.getByLabelText('Do you want to report any other issues regarding KOC? *') as unknown as HTMLSelectElement).value).toBe('');
});

function openReview() {
  render(createElement(ClusterReportForm, { profile, campuses }));
  fireEvent.click(screen.getByLabelText('Incident'));
  fireEvent.change(screen.getByLabelText('Do you want to report any other issues regarding KOC? *'), { target: { value: 'no' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review answers' }));
}
it('waits for persistence before showing success and blocks duplicate clicks', async () => {
  let resolve!: (value: { id: string; created_at: string }) => void;
  api.submit.mockReturnValue(new Promise(done => { resolve = done; }));
  openReview();
  fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
  const sending = screen.getByRole('button', { name: 'Submitting…' }) as HTMLButtonElement;
  expect(sending.disabled).toBe(true);
  fireEvent.click(sending);
  expect(api.submit).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Report submitted')).toBeNull();
  resolve({ id: 'saved-report-123', created_at: '2026-10-07T10:00:00Z' });
  expect(await screen.findByText('Report submitted')).toBeTruthy();
  expect(screen.getByText(/saved-report-123/)).toBeTruthy();
});
it('retains review after failure and retries with the same request ID', async () => {
  api.submit.mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce({ id: 'saved-retry', created_at: '2026-10-07T10:00:00Z' });
  openReview();
  fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Connection failed'));
  fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
  await screen.findByText('Report submitted');
  expect(api.submit.mock.calls[0][1]).toBe(api.submit.mock.calls[1][1]);
  expect(api.submit.mock.calls[0][0].incident).toBe('no');
});

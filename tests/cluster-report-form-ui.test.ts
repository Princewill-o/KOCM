// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ClusterReportForm from '../app/views/cluster-report-form';
import type { Profile } from '../lib/koc';
afterEach(cleanup);
const profile = { full_name: 'Test Lead', cluster_id: 'cluster-a', role: 'cluster' } as Profile;
const campuses = [{ id: 'own-campus', name: 'Own University', region: 'London', cluster_id: 'cluster-a' }, { id: 'other-campus', name: 'Other University', region: 'North', cluster_id: 'cluster-b' }];
it('shows only assigned campuses and provides review without a submit control', () => {
  const { container } = render(createElement(ClusterReportForm, { profile, campuses }));
  expect(screen.queryByRole('option', { name: 'Other University' })).toBeNull();
  expect(container.querySelector('[type="submit"]')).toBeNull();
  fireEvent.click(screen.getByLabelText('Incident'));
  fireEvent.change(screen.getByLabelText('Do you want to report any other issues regarding KOC? *'), { target: { value: 'no' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review answers' }));
  expect(screen.getByText('No report has been sent or saved.')).toBeTruthy();
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

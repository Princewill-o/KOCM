import {describe,it,expect} from 'vitest';
import {collectPages} from '../lib/pagination';
describe('API row caps', () => {
  it('fetches later rows so alerts beyond the first page remain readable', async () => {
    const all = [1,2,3,4,5]; const ranges: number[][]=[];
    expect(await collectPages(async (from,to)=>{ranges.push([from,to]);return all.slice(from,to+1);},2)).toEqual(all);
    expect(ranges).toEqual([[0,1],[2,3],[4,5]]);
  });
  it('does not present a partial history when a later page fails', async () => {
    await expect(collectPages(async from => {if(from) throw new Error('Offline'); return [1,2];},2)).rejects.toThrow('Offline');
  });
});

import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const buildRow = (post: any, index: number) => ({
  'Sr. No.': index + 1,
  'Due Date': post.designDueDate ? format(new Date(post.designDueDate), 'dd/MM/yyyy') : '',
  'Posting Date': post.scheduledAt ? format(new Date(post.scheduledAt), 'dd/MM/yyyy') : '',
  'Content Type': post.type || '',
  'Title/Topic': post.title || '',
  'Content Details- Writeup': post.writeUp || post.caption || '',
  'Reference URL': post.referenceUrl || (post.customData && post.customData.referenceUrl) || '',
  'Visual Direction': '',
  'Design Done': post.status === 'APPROVED' ? '✔' : '',
  'Approved Image': '',
  Caption: post.caption || '',
  Hashtags: '',
  Done: post.status === 'POSTED' ? '✔' : '',
});

export const exportCalendarToExcel = async (
  posts: any[],
  monthYearText: string = 'Content Calendar',
  weekFocusText: string = ''
) => {
  const headers = [
    'Sr. No.',
    'Due Date',
    'Posting Date',
    'Content Type',
    'Title/Topic',
    'Content Details- Writeup',
    'Reference URL',
    'Visual Direction',
    'Design Done',
    'Approved Image',
    'Caption',
    'Hashtags',
    'Done',
  ];

  const rows = posts.map(buildRow);
  const worksheetData = [
    { '': monthYearText },
    { '': weekFocusText },
    headers.reduce((acc, header) => ({ ...acc, [header]: header }), {} as Record<string, string>),
    ...rows,
  ];

  const worksheet = XLSX.utils.json_to_sheet(worksheetData, { skipHeader: true });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Content Calendar');

  const workbookOutput = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  });

  const blob = new Blob([workbookOutput], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const fileName = `Content_Calendar_${format(new Date(), 'MMM_yyyy')}.xlsx`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

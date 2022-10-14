import { Prisma } from '@prisma/client';
import { Job, Queue, Worker } from 'bullmq';
import path from 'path';
import { logger } from '../../utils/logging';
import { sanitizer } from '../../utils/sanitize';
import { findMissingChapters } from '../utils/mangal';
import { downloadQueue } from './download';

const cronMap = {
  daily: '0 0 * * *',
  hourly: '0 * * * *',
  minutely: '* * * * *',
  weekly: '0 * * * 7',
};

const mangaWithLibrary = Prisma.validator<Prisma.MangaArgs>()({
  include: { Library: true },
});

export type MangaWithLibrary = Prisma.MangaGetPayload<typeof mangaWithLibrary>;

const checkChapters = async (manga: MangaWithLibrary) => {
  logger.info(`Checking for new chapters: ${manga.title}`);
  const mangaDir = path.resolve(manga.Library.path, sanitizer(manga.title));
  const missingChapters = await findMissingChapters(mangaDir, manga.source, manga.title);

  if (missingChapters.length === 0) {
    logger.info(`There are no missing chapters for ${manga.title}`);
  } else {
    logger.info(`There are ${missingChapters.length} new chapters for ${manga.title}`);
  }

  await Promise.all(
    missingChapters.map(async (chapterIndex) => {
      const job = await downloadQueue.getJob(`${sanitizer(manga.title)}_${chapterIndex - 1}_download`);
      if (job) {
        await job.remove();
      }
    }),
  );

  await downloadQueue.addBulk(
    missingChapters.map((chapterIndex) => ({
      opts: {
        jobId: `${sanitizer(manga.title)}_${chapterIndex - 1}_download`,
      },
      name: `${sanitizer(manga.title)}_${chapterIndex - 1}_download`,
      data: {
        chapterIndex: chapterIndex - 1,
        source: manga.source,
        title: manga.title,
        libraryPath: manga.Library.path,
      },
    })),
  );
};

export const checkChaptersQueue = new Queue('checkChaptersQueue', {
  connection: {
    host: 'localhost',
    port: 6379,
  },
});

export const checkChaptersWorker = new Worker(
  'checkChaptersQueue',
  async (job: Job) => {
    const { manga }: { manga: MangaWithLibrary } = job.data;
    await checkChapters(manga);
    await job.updateProgress(100);
  },
  {
    concurrency: 5,
    connection: {
      host: 'localhost',
      port: 6379,
    },
  },
);

export const schedule = async (manga: MangaWithLibrary) => {
  if (manga.interval === 'never') {
    return;
  }

  await checkChaptersQueue.add(
    `check_${manga.title}_chapters`,
    {
      manga,
    },
    {
      jobId: `check_${manga.libraryId}_${manga.id}_chapters`,
      repeatJobKey: `check_${manga.libraryId}_${manga.id}_chapters`,
      repeat: {
        pattern: cronMap[manga.interval as keyof typeof cronMap],
      },
    },
  );

  await checkChapters(manga);
};

import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

const STORAGE_ROOT = join(process.cwd(), 'uploads');

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    companyId: string,
    uploaderId: string,
    file: Express.Multer.File,
    category: string,
  ) {
    const storageKey = join(
      companyId,
      category.toLowerCase(),
      `${randomUUID()}${extname(file.originalname)}`,
    );
    const absolutePath = join(STORAGE_ROOT, storageKey);

    await fs.mkdir(join(absolutePath, '..'), { recursive: true });
    await fs.writeFile(absolutePath, file.buffer);

    return this.prisma.file.create({
      data: {
        companyId,
        uploadedById: uploaderId,
        originalName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
  }

  async remove(fileId: string, deletedBy: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, deletedAt: null },
    });
    if (!file) throw new NotFoundException('File not found');

    await fs.unlink(join(STORAGE_ROOT, file.storageKey)).catch(() => undefined);
    await this.prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: new Date(), deletedBy },
    });
  }
}

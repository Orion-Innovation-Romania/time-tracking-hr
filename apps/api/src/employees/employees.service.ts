import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  canonicalizeName,
  toDisplayName,
  type EmployeeScheduleInput,
  type EmployeeView,
} from '@ttah/shared';
import { PrismaService } from '../prisma/prisma.service';

type EmployeeWithRelations = Prisma.EmployeeGetPayload<{
  include: { departments: true; aliases: true; schedule: true };
}>;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(employee: EmployeeWithRelations): EmployeeView {
    return {
      id: employee.id,
      canonicalName: employee.canonicalName,
      displayName: employee.displayName,
      active: employee.active,
      departments: employee.departments.map((d) => d.department),
      aliases: employee.aliases.map((a) => a.rawUserName),
    };
  }

  async list(search?: string, includeInactive = false): Promise<EmployeeView[]> {
    const filters: Prisma.EmployeeWhereInput[] = [];
    if (!includeInactive) filters.push({ active: true });
    if (search) {
      filters.push({
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { canonicalName: { contains: canonicalizeName(search) } },
        ],
      });
    }
    const rows = await this.prisma.employee.findMany({
      where: filters.length ? { AND: filters } : {},
      include: { departments: true, aliases: true, schedule: true },
      orderBy: { displayName: 'asc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async getById(id: number): Promise<EmployeeView> {
    const row = await this.prisma.employee.findUnique({
      where: { id },
      include: { departments: true, aliases: true, schedule: true },
    });
    if (!row) throw new NotFoundException('Employee not found');
    return this.toView(row);
  }

  async departments(): Promise<string[]> {
    const rows = await this.prisma.employeeDepartment.findMany({
      distinct: ['department'],
      select: { department: true },
      orderBy: { department: 'asc' },
    });
    return rows.map((r) => r.department);
  }

  async update(
    id: number,
    data: { displayName?: string; active?: boolean; notes?: string | null },
  ): Promise<EmployeeView> {
    await this.prisma.employee.update({ where: { id }, data });
    return this.getById(id);
  }

  async remove(id: number): Promise<{ ok: true }> {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');
    await this.prisma.employee.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Resolve (or lazily create) the employee behind a raw report user name.
   * Matching order: exact alias -> canonical name -> create new. Aliases and
   * departments are recorded so future imports and name variants converge.
   */
  async resolveEmployee(rawUserName: string, department?: string | null) {
    const canonical = canonicalizeName(rawUserName);
    const alias = await this.prisma.employeeAlias.findUnique({
      where: { rawUserName },
      include: { employee: true },
    });

    let employee =
      alias?.employee ??
      (await this.prisma.employee.findUnique({ where: { canonicalName: canonical } }));

    if (!employee) {
      employee = await this.prisma.employee.create({
        data: { canonicalName: canonical, displayName: toDisplayName(rawUserName) },
      });
    }

    await this.prisma.employeeAlias.upsert({
      where: { rawUserName },
      create: { rawUserName, employeeId: employee.id },
      update: {},
    });

    if (department) {
      await this.prisma.employeeDepartment.upsert({
        where: { employeeId_department: { employeeId: employee.id, department } },
        create: { employeeId: employee.id, department },
        update: {},
      });
    }

    return employee;
  }

  getSchedule(employeeId: number) {
    return this.prisma.employeeSchedule.findUnique({ where: { employeeId } });
  }

  async setSchedule(employeeId: number, input: Omit<EmployeeScheduleInput, 'employeeId'>) {
    await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    return this.prisma.employeeSchedule.upsert({
      where: { employeeId },
      create: {
        employeeId,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        workingDays: input.workingDays ?? [],
      },
      update: {
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        workingDays: input.workingDays ?? [],
      },
    });
  }
}

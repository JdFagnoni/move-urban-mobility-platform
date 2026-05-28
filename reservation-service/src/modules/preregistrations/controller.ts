import type { Request, Response } from "express";
import { getRequestContext } from "@move/shared";
import { handleServiceError } from "../../http/handler";
import {
  parseCreateCompanyLocationDTO,
  parseCreateCompanyProductDTO,
  parseUpdateCompanyLocationDTO,
  parseUpdateCompanyProductDTO,
} from "./parser";
import {
  createCompanyLocationForHttp,
  createCompanyProductForHttp,
  deleteCompanyLocationForHttp,
  deleteCompanyProductForHttp,
  listCompanyLocationsForHttp,
  listCompanyProductsForHttp,
  updateCompanyLocationForHttp,
  updateCompanyProductForHttp,
} from "./service";

export async function listProductsHandler(req: Request, res: Response): Promise<void> {
  const context = getRequestContext(req);
  const result = await handleServiceError(
    res,
    () =>
      listCompanyProductsForHttp({
        currentUser: req.authenticatedUser?.profile,
        context,
      }),
    context
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function createProductHandler(req: Request, res: Response): Promise<void> {
  const context = getRequestContext(req);
  const result = await handleServiceError(
    res,
    () =>
      createCompanyProductForHttp({
        dto: parseCreateCompanyProductDTO(req.body),
        currentUser: req.authenticatedUser?.profile,
        context,
      }),
    context
  );
  if (!result.ok) {
    return;
  }

  res.status(201).json({ success: true, data: result.data });
}

export async function updateProductHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const context = getRequestContext(req);
  const result = await handleServiceError(
    res,
    () =>
      updateCompanyProductForHttp({
        id,
        dto: parseUpdateCompanyProductDTO(req.body),
        currentUser: req.authenticatedUser?.profile,
        context,
      }),
    context
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function deleteProductHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const context = getRequestContext(req);
  const result = await handleServiceError(
    res,
    () =>
      deleteCompanyProductForHttp({
        id,
        currentUser: req.authenticatedUser?.profile,
        context,
      }),
    context
  );
  if (!result.ok) {
    return;
  }

  res.status(204).end();
}

export async function listLocationsHandler(req: Request, res: Response): Promise<void> {
  const context = getRequestContext(req);
  const result = await handleServiceError(
    res,
    () =>
      listCompanyLocationsForHttp({
        currentUser: req.authenticatedUser?.profile,
        context,
      }),
    context
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function createLocationHandler(req: Request, res: Response): Promise<void> {
  const context = getRequestContext(req);
  const result = await handleServiceError(
    res,
    () =>
      createCompanyLocationForHttp({
        dto: parseCreateCompanyLocationDTO(req.body),
        currentUser: req.authenticatedUser?.profile,
        context,
      }),
    context
  );
  if (!result.ok) {
    return;
  }

  res.status(201).json({ success: true, data: result.data });
}

export async function updateLocationHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const context = getRequestContext(req);
  const result = await handleServiceError(
    res,
    () =>
      updateCompanyLocationForHttp({
        id,
        dto: parseUpdateCompanyLocationDTO(req.body),
        currentUser: req.authenticatedUser?.profile,
        context,
      }),
    context
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function deleteLocationHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const context = getRequestContext(req);
  const result = await handleServiceError(
    res,
    () =>
      deleteCompanyLocationForHttp({
        id,
        currentUser: req.authenticatedUser?.profile,
        context,
      }),
    context
  );
  if (!result.ok) {
    return;
  }

  res.status(204).end();
}

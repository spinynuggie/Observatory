import { HttpStatusCode } from "axios";
import {
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  test,
} from "bun:test";

import config from "../src/config";
import { BeatmapsManager } from "../src/core/managers/beatmaps/beatmaps.manager";
import type { MirrorsManager } from "../src/core/managers/mirrors/mirrors.manager";
import type { StorageManager } from "../src/core/managers/storage/storage.manager";
import { FakerGenerator } from "./utils/faker.generator";

describe("BeatmapsManager", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    config.MirrorsToIgnore = [
      "direct",
      "mino",
      "osulabs",
      "gatari",
      "nerinyan",
      "bancho",
    ];
  });

  const createManager = (
    storageManager: Partial<StorageManager>,
    mirrorsManager: Partial<MirrorsManager>,
  ) => {
    const manager = new BeatmapsManager();

    // @ts-expect-error replacing private dependencies for a focused unit test
    manager.StorageManager = storageManager;
    // @ts-expect-error replacing private dependencies for a focused unit test
    manager.MirrorsManager = mirrorsManager;

    return manager;
  };

  test("getBeatmapSet falls back to mirrors on storage miss", async () => {
    const beatmapSetId = 2525398;
    const beatmapset = FakerGenerator.generateBeatmapset({
      id: beatmapSetId,
    });
    const getBeatmapSetFromStorage = mock(async () => {});
    const getBeatmapSetFromMirror = mock(async () => ({
      result: beatmapset,
      status: HttpStatusCode.Ok,
    }));
    const insertBeatmapset = mock(async () => {});
    const manager = createManager(
      {
        getBeatmapSet: getBeatmapSetFromStorage,
        insertBeatmapset,
      } as Partial<StorageManager>,
      {
        getBeatmapSet: getBeatmapSetFromMirror,
      } as Partial<MirrorsManager>,
    );

    const result = await manager.getBeatmapSet({
      beatmapSetId,
      allowMissingNonBeatmapValues: true,
    });

    expect(getBeatmapSetFromStorage).toHaveBeenCalledWith({
      beatmapSetId,
      allowMissingNonBeatmapValues: true,
    });
    expect(getBeatmapSetFromMirror).toHaveBeenCalledWith({
      beatmapSetId,
      allowMissingNonBeatmapValues: true,
    });
    expect(insertBeatmapset).toHaveBeenCalledWith(beatmapset, {
      beatmapSetId,
      allowMissingNonBeatmapValues: true,
    });
    expect(result).toEqual({
      data: beatmapset,
      status: HttpStatusCode.Ok,
      message: undefined,
      source: "mirror",
    });
  });

  test("getBeatmapSet keeps cached not-found responses in storage", async () => {
    const beatmapSetId = 2525398;
    const getBeatmapSetFromStorage = mock(async () => null);
    const getBeatmapSetFromMirror = mock(async () => ({
      result: FakerGenerator.generateBeatmapset({ id: beatmapSetId }),
      status: HttpStatusCode.Ok,
    }));
    const manager = createManager(
      {
        getBeatmapSet: getBeatmapSetFromStorage,
      } as Partial<StorageManager>,
      {
        getBeatmapSet: getBeatmapSetFromMirror,
      } as Partial<MirrorsManager>,
    );

    const result = await manager.getBeatmapSet({ beatmapSetId });

    expect(getBeatmapSetFromMirror).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: null,
      status: HttpStatusCode.NotFound,
      message: "Beatmapset not found",
      source: "storage",
    });
  });

  test("getBeatmapSet keeps real upstream 404s as not found", async () => {
    const beatmapSetId = 2525398;
    const getBeatmapSetFromStorage = mock(async () => {});
    const getBeatmapSetFromMirror = mock(async () => ({
      result: null,
      status: HttpStatusCode.NotFound,
    }));
    const insertBeatmapset = mock(async () => {});
    const manager = createManager(
      {
        getBeatmapSet: getBeatmapSetFromStorage,
        insertBeatmapset,
      } as Partial<StorageManager>,
      {
        getBeatmapSet: getBeatmapSetFromMirror,
      } as Partial<MirrorsManager>,
    );

    const result = await manager.getBeatmapSet({ beatmapSetId });

    expect(insertBeatmapset).toHaveBeenCalledWith(null, { beatmapSetId });
    expect(result).toEqual({
      data: null,
      status: HttpStatusCode.NotFound,
      message: "Beatmapset not found",
      source: "mirror",
    });
  });
});

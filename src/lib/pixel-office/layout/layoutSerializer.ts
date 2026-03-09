import { TileType, FurnitureType, DEFAULT_COLS, DEFAULT_ROWS, TILE_SIZE, Direction } from '../types'
import type { TileType as TileTypeVal, OfficeLayout, PlacedFurniture, Seat, FurnitureInstance, FloorColor } from '../types'
import { getCatalogEntry } from './furnitureCatalog'
import { isWalkable } from './tileMap'
import { getColorizedSprite } from '../colorize'

/** Convert flat tile array from layout into 2D grid */
export function layoutToTileMap(layout: OfficeLayout): TileTypeVal[][] {
  const map: TileTypeVal[][] = []
  for (let r = 0; r < layout.rows; r++) {
    const row: TileTypeVal[] = []
    for (let c = 0; c < layout.cols; c++) {
      row.push(layout.tiles[r * layout.cols + c])
    }
    map.push(row)
  }
  return map
}

/** Convert placed furniture into renderable FurnitureInstance[] */
export function layoutToFurnitureInstances(furniture: PlacedFurniture[]): FurnitureInstance[] {
  // Pre-compute desk zY per tile so surface items can sort in front of desks
  const deskZByTile = new Map<string, number>()
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry || !entry.isDesk) continue
    const deskZY = item.row * TILE_SIZE + entry.sprite.length
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`
        const prev = deskZByTile.get(key)
        if (prev === undefined || deskZY > prev) deskZByTile.set(key, deskZY)
      }
    }
  }

  const instances: FurnitureInstance[] = []
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry) continue
    const x = item.col * TILE_SIZE
    const y = item.row * TILE_SIZE
    const spriteH = entry.sprite.length
    let zY = y + spriteH

    // Chair z-sorting: ensure characters sitting on chairs render correctly
    if (entry.category === 'chairs') {
      if (entry.orientation === 'back') {
        // Back-facing chairs render IN FRONT of the seated character
        // (the chair back visually occludes the character behind it)
        zY = (item.row + 1) * TILE_SIZE + 1
      } else {
        // All other chairs: cap zY to first row bottom so characters
        // at any seat tile render in front of the chair
        zY = (item.row + 1) * TILE_SIZE
      }
    }

    // Surface items render in front of the desk they sit on
    if (entry.canPlaceOnSurfaces) {
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          const key = `${Math.round(item.col + dc)},${Math.round(item.row + dr)}`
          const deskZ = deskZByTile.get(key)
          if (deskZ !== undefined && deskZ + 0.5 > zY) zY = deskZ + 0.5
        }
      }
    }

    let sprite = entry.sprite
    if (item.color) {
      const { h, s, b: bv, c: cv } = item.color
      sprite = getColorizedSprite(`furn-${item.type}-${h}-${s}-${bv}-${cv}-${item.color.colorize ? 1 : 0}`, entry.sprite, item.color)
    }

    // 挂墙家具（画/白板）：
    // 1. renderY 向上偏移一格，让精灵视觉上覆盖墙面
    // 2. zY 强制设为 y+TILE_SIZE+0.5，保证比墙实例的 zY=(row+1)*TILE_SIZE 大，
    //    从而确保在墙之后渲染，不被墙 3D 精灵覆盖
    let renderY = y
    if (entry.canPlaceOnWalls) {
      renderY = y - TILE_SIZE
      zY = y + TILE_SIZE + 0.5
    }

    instances.push({ sprite, x, y: renderY, zY, ...(entry.emoji ? { emoji: entry.emoji } : {}), ...(item.rotation ? { rotation: item.rotation } : {}), ...(entry.emojiScale ? { emojiScale: entry.emojiScale } : {}) })
  }
  return instances
}

/** Get all tiles blocked by furniture footprints, optionally excluding a set of tiles.
 *  Skips top backgroundTiles rows so characters can walk through them. */
export function getBlockedTiles(furniture: PlacedFurniture[], excludeTiles?: Set<string>): Set<string> {
  const tiles = new Set<string>()
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry) continue
    const bgRows = entry.backgroundTiles || 0
    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < bgRows) continue // skip background rows — characters can walk through
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`
        if (excludeTiles && excludeTiles.has(key)) continue
        tiles.add(key)
      }
    }
  }
  return tiles
}

/** Get tiles blocked for placement purposes — skips top backgroundTiles rows per item */
export function getPlacementBlockedTiles(furniture: PlacedFurniture[], excludeUid?: string): Set<string> {
  const tiles = new Set<string>()
  for (const item of furniture) {
    if (item.uid === excludeUid) continue
    const entry = getCatalogEntry(item.type)
    if (!entry) continue
    const bgRows = entry.backgroundTiles || 0
    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < bgRows) continue // skip background rows
      for (let dc = 0; dc < entry.footprintW; dc++) {
        tiles.add(`${item.col + dc},${item.row + dr}`)
      }
    }
  }
  return tiles
}

/** Map chair orientation to character facing direction */
function orientationToFacing(orientation: string): Direction {
  switch (orientation) {
    case 'front': return Direction.DOWN
    case 'back': return Direction.UP
    case 'left': return Direction.LEFT
    case 'right': return Direction.RIGHT
    default: return Direction.DOWN
  }
}

/** Generate seats from chair furniture.
 *  Facing priority: 1) chair orientation, 2) adjacent desk, 3) forward (DOWN). */
export function layoutToSeats(furniture: PlacedFurniture[]): Map<string, Seat> {
  const seats = new Map<string, Seat>()

  // Build set of all desk tiles
  const deskTiles = new Set<string>()
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry || !entry.isDesk) continue
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        deskTiles.add(`${item.col + dc},${item.row + dr}`)
      }
    }
  }

  const dirs: Array<{ dc: number; dr: number; facing: Direction }> = [
    { dc: 0, dr: -1, facing: Direction.UP },    // desk is above chair → face UP
    { dc: 0, dr: 1, facing: Direction.DOWN },   // desk is below chair → face DOWN
    { dc: -1, dr: 0, facing: Direction.LEFT },   // desk is left of chair → face LEFT
    { dc: 1, dr: 0, facing: Direction.RIGHT },   // desk is right of chair → face RIGHT
  ]

  // For each chair, every footprint tile becomes a seat.
  // Multi-tile chairs (e.g. 2-tile couches) produce multiple seats.
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry || entry.category !== 'chairs') continue

    let seatCount = 0
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const tileCol = item.col + dc
        const tileRow = item.row + dr

        // Determine facing direction:
        // 1) Chair orientation takes priority
        // 2) Adjacent desk direction (use rounded coords for grid lookup)
        // 3) Default forward (DOWN)
        let facingDir: Direction = Direction.DOWN
        const roundedCol = Math.round(tileCol)
        const roundedRow = Math.round(tileRow)
        if (entry.orientation) {
          facingDir = orientationToFacing(entry.orientation)
        } else {
          for (const d of dirs) {
            if (deskTiles.has(`${roundedCol + d.dc},${roundedRow + d.dr}`)) {
              facingDir = d.facing
              break
            }
          }
        }

        // First seat uses chair uid (backward compat), subsequent use uid:N
        const seatUid = seatCount === 0 ? item.uid : `${item.uid}:${seatCount}`
        seats.set(seatUid, {
          uid: seatUid,
          seatCol: tileCol,
          seatRow: tileRow,
          facingDir,
          assigned: false,
        })
        seatCount++
      }
    }
  }

  return seats
}

/** Get the set of tiles occupied by seats (so they can be excluded from blocked tiles) */
export function getSeatTiles(seats: Map<string, Seat>): Set<string> {
  const tiles = new Set<string>()
  for (const seat of seats.values()) {
    tiles.add(`${Math.round(seat.seatCol)},${Math.round(seat.seatRow)}`)
  }
  return tiles
}

/** 宝可梦训练师中心配色 */
const DEFAULT_LEFT_ROOM_COLOR: FloorColor = { h: 38, s: 28, b: 20, c: 5 }   // 暖奶油色工作区
const DEFAULT_RIGHT_ROOM_COLOR: FloorColor = { h: 30, s: 35, b: 12, c: 8 }  // 温暖木色训练区
const DEFAULT_CARPET_COLOR: FloorColor = { h: 355, s: 50, b: -5, c: 5 }     // 宝可梦红色地毯
const DEFAULT_DOORWAY_COLOR: FloorColor = { h: 42, s: 40, b: 15, c: 0 }     // 金色走廊
const DEFAULT_LOUNGE_COLOR: FloorColor = { h: 195, s: 25, b: 15, c: 0 }     // 清新蓝色大厅

/** 创建办公园区布局 — 建筑(36×20)居中，草坪自适应填充 */
export function createDefaultLayout(totalCols?: number, totalRows?: number): OfficeLayout {
  const W = TileType.WALL
  const F1 = TileType.FLOOR_1
  const F2 = TileType.FLOOR_2
  const F3 = TileType.FLOOR_3
  const F4 = TileType.FLOOR_4
  const F5 = TileType.FLOOR_5  // 草地
  const F6 = TileType.FLOOR_6  // 石板小路
  const F7 = TileType.FLOOR_7  // 花圃

  // 建筑尺寸固定
  const bw = 36, bh = 20

  // 动态计算总地图尺寸（至少比建筑大2格以留最小草地边）
  const cols = Math.max(bw + 2, totalCols || bw + 8)
  const rows = Math.max(bh + 2, totalRows || bh + 6)

  // 建筑居中
  const bx = Math.floor((cols - bw) / 2)
  const by = Math.floor((rows - bh) / 2)

  const tiles: TileTypeVal[] = []
  const tileColors: Array<FloorColor | null> = []

  // 配色
  const grass: FloorColor = { h: 110, s: 40, b: 12, c: 5 }
  const stonePath: FloorColor = { h: 35, s: 15, b: 25, c: 0 }
  const flowerBed: FloorColor = { h: 340, s: 35, b: 15, c: 5 }
  const corridor: FloorColor = { h: 38, s: 22, b: 24, c: 3 }
  const devRoom: FloorColor = { h: 28, s: 32, b: 14, c: 6 }
  const opsRoom: FloorColor = { h: 22, s: 36, b: 10, c: 8 }
  const lounge: FloorColor = { h: 195, s: 20, b: 20, c: 0 }
  const meeting: FloorColor = { h: 32, s: 28, b: 16, c: 5 }
  const serverRoom: FloorColor = { h: 210, s: 30, b: 5, c: 10 }
  const carpet: FloorColor = { h: 355, s: 45, b: -5, c: 5 }
  const doorway: FloorColor = { h: 42, s: 35, b: 20, c: 0 }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const inBX = c >= bx && c < bx + bw
      const inBY = r >= by && r < by + bh
      const inB = inBX && inBY

      // 外围草地景观
      if (!inB) {
        const isEntryPath = c >= bx + 16 && c <= bx + 19 && r >= by + bh && r < rows
        const isTopPath = r === by - 1 && c >= bx + 2 && c <= bx + bw - 3
        const isSidePath = (c === bx - 1 || c === bx + bw) && r >= by + 2 && r <= by + bh - 3
        const isFlower = (r === by + bh && ((c >= bx + 5 && c <= bx + 8) || (c >= bx + 27 && c <= bx + 30)))
          || (r === by - 1 && ((c >= bx + 8 && c <= bx + 11) || (c >= bx + 24 && c <= bx + 27)))

        if (isEntryPath || isTopPath || isSidePath) {
          tiles.push(F6); tileColors.push(stonePath)
        } else if (isFlower) {
          tiles.push(F7); tileColors.push(flowerBed)
        } else {
          tiles.push(F5); tileColors.push(grass)
        }
        continue
      }

      // 办公楼内部（相对坐标）
      const lr = r - by, lc = c - bx

      // 外墙（底部入口门洞）
      if (lr === 0 || lr === bh - 1 || lc === 0 || lc === bw - 1) {
        if (lr === bh - 1 && lc >= 16 && lc <= 19) {
          tiles.push(F4); tileColors.push(doorway)
        } else { tiles.push(W); tileColors.push(null) }
        continue
      }
      // 中间走廊 (lr=9)
      if (lr === 9) {
        if ((lc >= 4 && lc <= 6) || (lc >= 16 && lc <= 18) || (lc >= 28 && lc <= 30)) {
          tiles.push(F4); tileColors.push(doorway)
        } else { tiles.push(W); tileColors.push(null) }
        continue
      }
      // 左分隔墙 (lc=11)
      if (lc === 11) {
        if ((lr >= 3 && lr <= 5) || (lr >= 13 && lr <= 15)) { tiles.push(F4); tileColors.push(doorway) }
        else { tiles.push(W); tileColors.push(null) }
        continue
      }
      // 右分隔墙 (lc=24)
      if (lc === 24) {
        if ((lr >= 3 && lr <= 5) || (lr >= 13 && lr <= 15)) { tiles.push(F4); tileColors.push(doorway) }
        else { tiles.push(W); tileColors.push(null) }
        continue
      }
      // 上左: 开发组
      if (lr >= 1 && lr <= 8 && lc >= 1 && lc <= 10) { tiles.push(F2); tileColors.push(devRoom); continue }
      // 上中: 大厅
      if (lr >= 1 && lr <= 8 && lc >= 12 && lc <= 23) {
        tiles.push(F1); tileColors.push(corridor)
        continue
      }
      // 上右: 运维组
      if (lr >= 1 && lr <= 8 && lc >= 25 && lc <= 34) { tiles.push(F2); tileColors.push(opsRoom); continue }
      // 下左: 休息室
      if (lr >= 10 && lr <= 17 && lc >= 1 && lc <= 10) {
        tiles.push(F1); tileColors.push(lounge)
        continue
      }
      // 下中: 会议室
      if (lr >= 10 && lr <= 17 && lc >= 12 && lc <= 23) {
        tiles.push(F2); tileColors.push(meeting)
        continue
      }
      // 下右: 服务器间
      if (lr >= 10 && lr <= 17 && lc >= 25 && lc <= 34) { tiles.push(F2); tileColors.push(serverRoom); continue }
      // 底走廊
      if (lr === 18 && lc >= 1 && lc <= 34) { tiles.push(F1); tileColors.push(corridor); continue }

      tiles.push(W); tileColors.push(null)
    }
  }

  const ox = bx, oy = by
  const furniture: PlacedFurniture[] = [
    // 开发组A
    { uid: 'da1', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 2, row: oy + 2 },
    { uid: 'ca1', type: FurnitureType.BENCH, col: ox + 2.5, row: oy + 1 },
    { uid: 'pa1', type: FurnitureType.PC, col: ox + 2.5, row: oy + 1.75, rotation: 180 },
    { uid: 'da2', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 5, row: oy + 2 },
    { uid: 'ca2', type: FurnitureType.BENCH, col: ox + 5.5, row: oy + 1 },
    { uid: 'pa2', type: FurnitureType.PC, col: ox + 5.5, row: oy + 1.75, rotation: 180 },
    { uid: 'da3', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 8, row: oy + 2 },
    { uid: 'ca3', type: FurnitureType.BENCH, col: ox + 8.5, row: oy + 1 },
    { uid: 'pa3', type: FurnitureType.PC, col: ox + 8.5, row: oy + 1.75, rotation: 180 },
    { uid: 'da4', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 2, row: oy + 5 },
    { uid: 'ca4', type: FurnitureType.BENCH, col: ox + 2.5, row: oy + 6 },
    { uid: 'da5', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 5, row: oy + 5 },
    { uid: 'ca5', type: FurnitureType.BENCH, col: ox + 5.5, row: oy + 6 },
    { uid: 'wba', type: FurnitureType.WHITEBOARD, col: ox + 7, row: oy },
    { uid: 'bsa', type: FurnitureType.BOOKSHELF, col: ox + 9, row: oy + 4 },
    { uid: 'la', type: FurnitureType.PLANT_SMALL, col: ox + 10, row: oy + 6 },
    // 大厅
    { uid: 'df', type: FurnitureType.DESK, col: ox + 16, row: oy + 1 },
    { uid: 'cf', type: FurnitureType.CHAIR, col: ox + 16, row: oy + 2 },
    { uid: 'clk', type: FurnitureType.CLOCK, col: ox + 19, row: oy },
    { uid: 'bnf1', type: FurnitureType.BENCH, col: ox + 15, row: oy + 7 },
    { uid: 'bnf2', type: FurnitureType.BENCH, col: ox + 20, row: oy + 7 },
    { uid: 'ptf', type: FurnitureType.PLANT_SMALL, col: ox + 12, row: oy + 6 },
    { uid: 'ptf2', type: FurnitureType.PLANT_SMALL, col: ox + 22, row: oy + 6 },
    // 运维组B
    { uid: 'db1', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 26, row: oy + 2 },
    { uid: 'cb1', type: FurnitureType.BENCH, col: ox + 26.5, row: oy + 1 },
    { uid: 'pb1', type: FurnitureType.PC, col: ox + 26.5, row: oy + 1.75, rotation: 180 },
    { uid: 'db2', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 29, row: oy + 2 },
    { uid: 'cb2', type: FurnitureType.BENCH, col: ox + 29.5, row: oy + 1 },
    { uid: 'db3', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 26, row: oy + 5 },
    { uid: 'cb3', type: FurnitureType.BENCH, col: ox + 26.5, row: oy + 6 },
    { uid: 'db4', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 29, row: oy + 5 },
    { uid: 'cb4', type: FurnitureType.BENCH, col: ox + 29.5, row: oy + 6 },
    { uid: 'lib_b', type: FurnitureType.LIBRARY_GRAY_FULL, col: ox + 32, row: oy - 0.5 },
    { uid: 'clk_b', type: FurnitureType.CLOCK, col: ox + 33, row: oy },
    { uid: 'cool_b', type: FurnitureType.BOOKSHELF, col: ox + 34, row: oy + 4 },
    // 休息室C
    { uid: 'sc', type: FurnitureType.SOFA, col: ox + 5, row: oy + 14 },
    { uid: 'bnc1', type: FurnitureType.BENCH, col: ox + 2, row: oy + 16 },
    { uid: 'bnc2', type: FurnitureType.BENCH, col: ox + 7, row: oy + 16 },
    { uid: 'vendc', type: FurnitureType.VENDING, col: ox + 1, row: oy + 10 },

    { uid: 'bsc', type: FurnitureType.BOOKSHELF, col: ox + 9, row: oy + 11 },
    { uid: 'plrc', type: FurnitureType.PLANT_SMALL, col: ox + 1, row: oy + 13 },
    { uid: 'lmc', type: FurnitureType.LAMP, col: ox + 8, row: oy + 14 },
    // ════ 会议室 D — 长桌居中 + 环形座椅 + 白板 ════
    // 中央长会议桌（两张桌拼合）
    { uid: 'dd1', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 16, row: oy + 13 },
    { uid: 'dd2', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 19, row: oy + 13 },
    // 桌子两侧围坐椅子
    { uid: 'cd1', type: FurnitureType.CHAIR, col: ox + 16, row: oy + 12 },  // 上排左
    { uid: 'cd2', type: FurnitureType.CHAIR, col: ox + 18, row: oy + 12 },  // 上排中
    { uid: 'cd3', type: FurnitureType.CHAIR, col: ox + 20, row: oy + 12 },  // 上排右
    { uid: 'cd4', type: FurnitureType.CHAIR, col: ox + 16, row: oy + 14 },  // 下排左
    { uid: 'cd5', type: FurnitureType.CHAIR, col: ox + 18, row: oy + 14 },  // 下排中
    { uid: 'cd6', type: FurnitureType.CHAIR, col: ox + 20, row: oy + 14 },  // 下排右
    // 白板挂在会议室墙上

    // 角落装饰
    { uid: 'ld', type: FurnitureType.PLANT_SMALL, col: ox + 23, row: oy + 10 },
    { uid: 'bsd', type: FurnitureType.BOOKSHELF, col: ox + 22, row: oy + 10 },
    { uid: 'ptd', type: FurnitureType.PLANT_SMALL, col: ox + 23, row: oy + 17 },
    // ════ 服务器间 E — SERVER_RACK emoji 机架 ════
    // 第一排机架
    { uid: 'srv1', type: FurnitureType.SERVER_RACK, col: ox + 26, row: oy + 10 },
    { uid: 'srv2', type: FurnitureType.SERVER_RACK, col: ox + 28, row: oy + 10 },
    { uid: 'srv3', type: FurnitureType.SERVER_RACK, col: ox + 30, row: oy + 10 },
    { uid: 'srv4', type: FurnitureType.SERVER_RACK, col: ox + 32, row: oy + 10 },
    // 第二排机架
    { uid: 'srv5', type: FurnitureType.SERVER_RACK, col: ox + 26, row: oy + 14 },
    { uid: 'srv6', type: FurnitureType.SERVER_RACK, col: ox + 28, row: oy + 14 },
    { uid: 'srv7', type: FurnitureType.SERVER_RACK, col: ox + 30, row: oy + 14 },
    { uid: 'srv8', type: FurnitureType.SERVER_RACK, col: ox + 32, row: oy + 14 },
    // 右墙额外机架
    { uid: 'rack1', type: FurnitureType.SERVER_RACK, col: ox + 34, row: oy + 11 },
    { uid: 'rack2', type: FurnitureType.SERVER_RACK, col: ox + 34, row: oy + 14 },
    // 底部监控工位
    { uid: 'de_mon', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 27, row: oy + 17 },
    { uid: 'ce_mon', type: FurnitureType.BENCH, col: ox + 27.5, row: oy + 16 },
    { uid: 'pe_mon', type: FurnitureType.PC, col: ox + 27.5, row: oy + 16.75, rotation: 180 },
    // ════ 室外景观 + 运动设施 ════
    // 上方草地 — 只在 row:0 放树（远离建筑墙 row:3）
    { uid: 'ot1', type: FurnitureType.PLANT, col: 0, row: 0 },
    { uid: 'ot2', type: FurnitureType.PLANT, col: 9, row: 0 },
    { uid: 'ot3', type: FurnitureType.PLANT, col: 17, row: 0 },
    { uid: 'ot4', type: FurnitureType.PLANT, col: 25, row: 0 },
    { uid: 'ot5', type: FurnitureType.PLANT, col: 33, row: 0 },
    { uid: 'ot6', type: FurnitureType.PLANT, col: 45, row: 0 },
    // 左侧草地 — col:0-1（建筑左墙 col:3 之外）
    { uid: 'ol2', type: FurnitureType.PLANT, col: 0, row: 6 },
    { uid: 'ol3', type: FurnitureType.PLANT, col: 0, row: 12 },
    { uid: 'ol4', type: FurnitureType.PLANT, col: 0, row: 18 },
    // 右侧草地 — col:44-45（建筑右墙 col:42 之外）
    { uid: 'or1', type: FurnitureType.PLANT, col: 45, row: 6 },
    { uid: 'or2', type: FurnitureType.PLANT, col: 45, row: 12 },
    { uid: 'or3', type: FurnitureType.PLANT, col: 45, row: 18 },
    // ──── 室外运动区（远离建筑墙壁） ────
    // 左上角：乒乓球台
    { uid: 'sport1', type: FurnitureType.PING_PONG, col: 0, row: 1 },
    // 右上角：篮球架
    { uid: 'sport2', type: FurnitureType.BASKETBALL, col: 45, row: 0 },
    // 左下角：健身器材
    { uid: 'sport3', type: FurnitureType.FITNESS, col: 0, row: 24 },
    // 右下角：自动售货机
    { uid: 'vend1', type: FurnitureType.VENDING, col: 45, row: 23 },
    // 下方草地 — row:24-25（建筑底墙 row:22 之外）
    { uid: 'ob3', type: FurnitureType.PLANT, col: 0, row: 24 },
    { uid: 'ob4', type: FurnitureType.PLANT, col: 9, row: 24 },
    { uid: 'ob5', type: FurnitureType.PLANT, col: 17, row: 24 },
    { uid: 'ob6', type: FurnitureType.PLANT, col: 25, row: 24 },
    { uid: 'ob7', type: FurnitureType.PLANT, col: 33, row: 24 },
    { uid: 'ob8', type: FurnitureType.PLANT, col: 45, row: 24 },
  ]

  return { version: 1, cols, rows, tiles, tileColors, furniture }
}

/** 团队专属3区域布局（工作区+交流区+休息区），草坪填充 */
export function createTeamLayout(totalCols?: number, totalRows?: number, teamName?: string): OfficeLayout {
  const W = TileType.WALL
  const F1 = TileType.FLOOR_1
  const F2 = TileType.FLOOR_2
  const F3 = TileType.FLOOR_3
  const F4 = TileType.FLOOR_4
  const F5 = TileType.FLOOR_5
  const F6 = TileType.FLOOR_6
  const F7 = TileType.FLOOR_7

  // 建筑：20×16（紧凑三区域）
  const bw = 20, bh = 16

  const cols = Math.max(bw + 2, totalCols || bw + 6)
  const rows = Math.max(bh + 2, totalRows || bh + 4)
  const bx = Math.floor((cols - bw) / 2)
  const by = Math.floor((rows - bh) / 2)

  const tiles: TileTypeVal[] = []
  const tileColors: Array<FloorColor | null> = []

  const grass: FloorColor = { h: 110, s: 40, b: 12, c: 5 }
  const stonePath: FloorColor = { h: 35, s: 15, b: 25, c: 0 }
  const flowerBed: FloorColor = { h: 340, s: 35, b: 15, c: 5 }
  const workColor: FloorColor = { h: 28, s: 32, b: 14, c: 6 }
  const meetColor: FloorColor = { h: 32, s: 28, b: 16, c: 5 }
  const restColor: FloorColor = { h: 195, s: 20, b: 20, c: 0 }
  const carpet: FloorColor = { h: 355, s: 45, b: -5, c: 5 }
  const doorway: FloorColor = { h: 42, s: 35, b: 20, c: 0 }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const inB = c >= bx && c < bx + bw && r >= by && r < by + bh

      if (!inB) {
        // 入口小路
        const isPath = c >= bx + 8 && c <= bx + 11 && r >= by + bh && r < rows
        if (isPath) { tiles.push(F6); tileColors.push(stonePath) }
        else { tiles.push(F5); tileColors.push(grass) }
        continue
      }

      const lr = r - by, lc = c - bx

      // 外墙
      if (lr === 0 || lr === bh - 1 || lc === 0 || lc === bw - 1) {
        if (lr === bh - 1 && lc >= 8 && lc <= 11) { tiles.push(F4); tileColors.push(doorway) }
        else { tiles.push(W); tileColors.push(null) }
        continue
      }

      // 水平分隔 (lr=8) — 工作区和下层
      if (lr === 8) {
        if (lc >= 8 && lc <= 11) { tiles.push(F4); tileColors.push(doorway) }
        else { tiles.push(W); tileColors.push(null) }
        continue
      }

      // 下层垂直分隔 (lc=10)
      if (lr >= 9 && lr <= 14 && lc === 10) {
        if (lr >= 11 && lr <= 12) { tiles.push(F4); tileColors.push(doorway) }
        else { tiles.push(W); tileColors.push(null) }
        continue
      }

      // 上层：工作区 (1-7, 1-18)
      if (lr >= 1 && lr <= 7 && lc >= 1 && lc <= 18) {
        tiles.push(F2); tileColors.push(workColor); continue
      }
      // 下左：交流区 (9-14, 1-9)
      if (lr >= 9 && lr <= 14 && lc >= 1 && lc <= 9) {
        tiles.push(F2); tileColors.push(meetColor)
        continue
      }
      // 下右：休息区 (9-14, 11-18)
      if (lr >= 9 && lr <= 14 && lc >= 11 && lc <= 18) {
        tiles.push(F1); tileColors.push(restColor); continue
      }
      // 底走廊
      if (lr === 15 && lc >= 1 && lc <= 18) { tiles.push(F1); tileColors.push({ h: 38, s: 22, b: 24, c: 3 }); continue }

      tiles.push(W); tileColors.push(null)
    }
  }

  const ox = bx, oy = by
  const furniture: PlacedFurniture[] = [
    // 工作区（3排桌子）
    { uid: 'tw1', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 2, row: oy + 2 },
    { uid: 'cw1', type: FurnitureType.BENCH, col: ox + 2.5, row: oy + 1 },
    { uid: 'pw1', type: FurnitureType.PC, col: ox + 2.5, row: oy + 1.75, rotation: 180 },
    { uid: 'tw2', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 5, row: oy + 2 },
    { uid: 'cw2', type: FurnitureType.BENCH, col: ox + 5.5, row: oy + 1 },
    { uid: 'pw2', type: FurnitureType.PC, col: ox + 5.5, row: oy + 1.75, rotation: 180 },
    { uid: 'tw3', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 8, row: oy + 2 },
    { uid: 'cw3', type: FurnitureType.BENCH, col: ox + 8.5, row: oy + 1 },
    { uid: 'pw3', type: FurnitureType.PC, col: ox + 8.5, row: oy + 1.75, rotation: 180 },
    { uid: 'tw4', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 11, row: oy + 2 },
    { uid: 'cw4', type: FurnitureType.BENCH, col: ox + 11.5, row: oy + 1 },
    { uid: 'pw4', type: FurnitureType.PC, col: ox + 11.5, row: oy + 1.75, rotation: 180 },
    { uid: 'tw5', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 14, row: oy + 2 },
    { uid: 'cw5', type: FurnitureType.BENCH, col: ox + 14.5, row: oy + 1 },
    { uid: 'tw6', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 2, row: oy + 5 },
    { uid: 'cw6', type: FurnitureType.BENCH, col: ox + 2.5, row: oy + 6 },
    { uid: 'tw7', type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 5, row: oy + 5 },
    { uid: 'cw7', type: FurnitureType.BENCH, col: ox + 5.5, row: oy + 6 },
    { uid: 'wb', type: FurnitureType.WHITEBOARD, col: ox + 16, row: oy },
    { uid: 'bsw', type: FurnitureType.BOOKSHELF, col: ox + 17, row: oy + 3 },
    { uid: 'lw', type: FurnitureType.PLANT_SMALL, col: ox + 18, row: oy + 6 },
    { uid: 'clk', type: FurnitureType.CLOCK, col: ox + 13, row: oy },
    // 交流区 — 中央桌椅 + 白板挂墙
    { uid: 'dm', type: FurnitureType.DESK, col: ox + 4, row: oy + 11 },
    { uid: 'cm1', type: FurnitureType.CHAIR, col: ox + 4, row: oy + 10 },
    { uid: 'cm2', type: FurnitureType.CHAIR, col: ox + 6, row: oy + 12 },
    { uid: 'cm3', type: FurnitureType.CHAIR, col: ox + 3, row: oy + 12 },
    { uid: 'wbm', type: FurnitureType.WHITEBOARD, col: ox + 1, row: oy + 8.5 },
    { uid: 'bsm', type: FurnitureType.BOOKSHELF, col: ox + 8, row: oy + 9 },
    // 休息区 — 沙发居中 + 售货机靠右墙 + 画挂墙上
    { uid: 'sr', type: FurnitureType.SOFA, col: ox + 14, row: oy + 11 },
    { uid: 'vendr', type: FurnitureType.VENDING, col: ox + 17, row: oy + 9 },
    { uid: 'ptr', type: FurnitureType.PAINTING_LARGE_2, col: ox + 13, row: oy + 8.5 },
    { uid: 'plr', type: FurnitureType.PLANT_SMALL, col: ox + 18, row: oy + 14 },
    { uid: 'lmr', type: FurnitureType.LAMP, col: ox + 16, row: oy + 12 },
    // 室外
    { uid: 'ot1', type: FurnitureType.PLANT, col: 1, row: 0 },
    { uid: 'ot2', type: FurnitureType.PLANT, col: cols - 2, row: 0 },
    { uid: 'ot3', type: FurnitureType.PLANT, col: 1, row: rows - 1 },
    { uid: 'ot4', type: FurnitureType.PLANT, col: cols - 2, row: rows - 1 },
    { uid: 'ob1', type: FurnitureType.BENCH, col: Math.floor(cols / 2) - 3, row: rows - 1 },
  ]

  return { version: 1, cols, rows, tiles, tileColors, furniture }
}

/** 根据团队数量动态生成办公楼布局 — 每个团队占一列（上下两间房），草坪填充 */
export function createDynamicOfficeLayout(teamCount: number, teamNames: string[], totalCols?: number, totalRows?: number): OfficeLayout {
  const W = TileType.WALL
  const F1 = TileType.FLOOR_1
  const F2 = TileType.FLOOR_2
  const F3 = TileType.FLOOR_3
  const F4 = TileType.FLOOR_4
  const F5 = TileType.FLOOR_5
  const F6 = TileType.FLOOR_6
  const F7 = TileType.FLOOR_7

  // 每个团队占 12 列宽（上下两间房），中间有 1 列墙
  const roomW = 12
  const numCols = Math.max(teamCount, 1)
  const bw = numCols * (roomW + 1) + 1  // 加左右墙和分隔墙
  const bh = 20

  const cols = Math.max(bw + 2, totalCols || bw + 6)
  const rows = Math.max(bh + 2, totalRows || bh + 6)
  const bx = Math.floor((cols - bw) / 2)
  const by = Math.floor((rows - bh) / 2)

  const tiles: TileTypeVal[] = []
  const tileColors: Array<FloorColor | null> = []

  const grass: FloorColor = { h: 110, s: 40, b: 12, c: 5 }
  const stonePath: FloorColor = { h: 35, s: 15, b: 25, c: 0 }
  const flowerBed: FloorColor = { h: 340, s: 35, b: 15, c: 5 }
  const corridor: FloorColor = { h: 38, s: 22, b: 24, c: 3 }
  const doorway: FloorColor = { h: 42, s: 35, b: 20, c: 0 }
  const carpet: FloorColor = { h: 355, s: 45, b: -5, c: 5 }

  // 每列房间的配色轮换
  const roomColors: FloorColor[] = [
    { h: 28, s: 32, b: 14, c: 6 },   // 暖木
    { h: 195, s: 20, b: 20, c: 0 },  // 清蓝
    { h: 22, s: 36, b: 10, c: 8 },   // 棕色
    { h: 210, s: 30, b: 5, c: 10 },  // 深蓝
    { h: 32, s: 28, b: 16, c: 5 },   // 金色
    { h: 160, s: 25, b: 15, c: 5 },  // 青绿
  ]

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const inB = c >= bx && c < bx + bw && r >= by && r < by + bh

      if (!inB) {
        // 入口小路
        let isPath = false
        const relCol = c - bx - 1
        if (r >= by + bh && c > bx && c < bx + bw - 1) {
          const rLocal = relCol % (roomW + 1)
          if (rLocal >= 5 && rLocal <= 7) isPath = true
        }

        if (isPath) { tiles.push(F6); tileColors.push(stonePath) }
        else { tiles.push(F5); tileColors.push(grass) }
        continue
      }

      const lr = r - by, lc = c - bx

      // 外墙
      if (lr === 0 || lr === bh - 1 || lc === 0 || lc === bw - 1) {
        // 底部入口
        const midX = Math.floor(bw / 2)
        if (lr === bh - 1 && lc >= midX - 2 && lc <= midX + 1) { tiles.push(F4); tileColors.push(doorway) }
        else { tiles.push(W); tileColors.push(null) }
        continue
      }

      // 中间走廊 (lr=9)
      if (lr === 9) {
        // 每列中间开门
        let isDoor = false
        for (let ti = 0; ti < numCols; ti++) {
          const colStart = 1 + ti * (roomW + 1)
          const doorPos = colStart + Math.floor(roomW / 2) - 1
          if (lc >= doorPos && lc <= doorPos + 2) isDoor = true
        }
        if (isDoor) { tiles.push(F4); tileColors.push(doorway) }
        else { tiles.push(W); tileColors.push(null) }
        continue
      }

      // 垂直分隔墙（每列之间）
      let isVertWall = false
      for (let ti = 1; ti < numCols; ti++) {
        const wallCol = ti * (roomW + 1)
        if (lc === wallCol) {
          // 开门位置
          if ((lr >= 3 && lr <= 5) || (lr >= 13 && lr <= 15)) { tiles.push(F4); tileColors.push(doorway) }
          else { tiles.push(W); tileColors.push(null) }
          isVertWall = true
          break
        }
      }
      if (isVertWall) continue

      // 确定属于哪个团队列
      const relCol = lc - 1
      const teamIdx = Math.floor(relCol / (roomW + 1))
      const localC = relCol - teamIdx * (roomW + 1)
      if (localC >= roomW || teamIdx >= numCols) { tiles.push(W); tileColors.push(null); continue }

      const color = roomColors[teamIdx % roomColors.length]

      // 上层房间 (lr 1-8)
      if (lr >= 1 && lr <= 8) {
        tiles.push(F2); tileColors.push(color)
        continue
      }
      // 下层房间 (lr 10-17)
      if (lr >= 10 && lr <= 17) {
        tiles.push(F1); tileColors.push({ ...color, h: (color.h + 15) % 360, s: color.s - 5 })
        continue
      }
      // 底走廊
      if (lr === 18) { tiles.push(F1); tileColors.push(corridor); continue }

      tiles.push(W); tileColors.push(null)
    }
  }

  const furniture: PlacedFurniture[] = []
  // 每列团队生成家具
  for (let ti = 0; ti < numCols; ti++) {
    const ox = bx + 1 + ti * (roomW + 1)
    const oy = by
    const p = `t${ti}_`

    // 上层：工作区
    furniture.push(
      { uid: `${p}d1`, type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 1, row: oy + 2 },
      { uid: `${p}c1`, type: FurnitureType.BENCH, col: ox + 1.5, row: oy + 1 },
      { uid: `${p}p1`, type: FurnitureType.PC, col: ox + 1.5, row: oy + 1.75, rotation: 180 },
      { uid: `${p}d2`, type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 4, row: oy + 2 },
      { uid: `${p}c2`, type: FurnitureType.BENCH, col: ox + 4.5, row: oy + 1 },
      { uid: `${p}p2`, type: FurnitureType.PC, col: ox + 4.5, row: oy + 1.75, rotation: 180 },
      { uid: `${p}d3`, type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 7, row: oy + 2 },
      { uid: `${p}c3`, type: FurnitureType.BENCH, col: ox + 7.5, row: oy + 1 },
      { uid: `${p}d4`, type: FurnitureType.TABLE_WOOD_SM_HORIZONTAL, col: ox + 1, row: oy + 5 },
      { uid: `${p}c4`, type: FurnitureType.BENCH, col: ox + 1.5, row: oy + 6 },
      { uid: `${p}wb`, type: FurnitureType.WHITEBOARD, col: ox + 9, row: oy },
      { uid: `${p}bs`, type: FurnitureType.BOOKSHELF, col: ox + 10, row: oy + 4 },
      { uid: `${p}la`, type: FurnitureType.PLANT_SMALL, col: ox + 11, row: oy + 6 },
    )
    // 下层：交流/办公
    furniture.push(
      { uid: `${p}dd`, type: FurnitureType.DESK, col: ox + 4, row: oy + 13 },
      { uid: `${p}cd1`, type: FurnitureType.CHAIR, col: ox + 4, row: oy + 12 },
      { uid: `${p}cd2`, type: FurnitureType.CHAIR, col: ox + 6, row: oy + 14 },
      { uid: `${p}cd3`, type: FurnitureType.CHAIR, col: ox + 3, row: oy + 14 },
      { uid: `${p}sf`, type: FurnitureType.SOFA, col: ox + 2, row: oy + 16 },
      { uid: `${p}fr`, type: FurnitureType.VENDING, col: ox + 10, row: oy + 10 },
      { uid: `${p}ld`, type: FurnitureType.PLANT_SMALL, col: ox + 11, row: oy + 14 },
      { uid: `${p}pl`, type: FurnitureType.PLANT, col: ox + 1, row: oy + 10 },
    )
  }

  // 室外装饰
  furniture.push(
    { uid: 'ot1', type: FurnitureType.PLANT, col: 1, row: 0 },
    { uid: 'ot2', type: FurnitureType.PLANT, col: cols - 2, row: 0 },
    { uid: 'ot3', type: FurnitureType.PLANT, col: 1, row: rows - 1 },
    { uid: 'ot4', type: FurnitureType.PLANT, col: cols - 2, row: rows - 1 },
    { uid: 'ob1', type: FurnitureType.BENCH, col: Math.floor(cols / 3), row: 1 },
    { uid: 'ob2', type: FurnitureType.BENCH, col: Math.floor(cols * 2 / 3), row: 1 },
  )

  return { version: 1, cols, rows, tiles, tileColors, furniture }
}

/** Serialize layout to JSON string */
export function serializeLayout(layout: OfficeLayout): string {
  return JSON.stringify(layout)
}

/** Deserialize layout from JSON string, migrating old tile types if needed */
export function deserializeLayout(json: string): OfficeLayout | null {
  try {
    const obj = JSON.parse(json)
    if (obj && obj.version === 1 && Array.isArray(obj.tiles) && Array.isArray(obj.furniture)) {
      return migrateLayout(obj as OfficeLayout)
    }
  } catch { /* ignore parse errors */ }
  return null
}

/**
 * Ensure layout has tileColors. If missing, generate defaults based on tile types.
 * Exported for use by message handlers that receive layouts over the wire.
 */
export function migrateLayoutColors(layout: OfficeLayout): OfficeLayout {
  return migrateLayout(layout)
}

/**
 * Migrate old layouts that use legacy tile types (TILE_FLOOR=1, WOOD_FLOOR=2, CARPET=3, DOORWAY=4)
 * to the new pattern-based system. If tileColors is already present, no migration needed.
 */
function migrateLayout(layout: OfficeLayout): OfficeLayout {
  if (layout.tileColors && layout.tileColors.length === layout.tiles.length) {
    return layout // Already migrated
  }

  // Check if any tiles use old values (1-4) — these map directly to FLOOR_1-4
  // but need color assignments
  const tileColors: Array<FloorColor | null> = []
  for (const tile of layout.tiles) {
    switch (tile) {
      case 0: // WALL
        tileColors.push(null)
        break
      case 1: // was TILE_FLOOR → FLOOR_1 beige
        tileColors.push(DEFAULT_LEFT_ROOM_COLOR)
        break
      case 2: // was WOOD_FLOOR → FLOOR_2 brown
        tileColors.push(DEFAULT_RIGHT_ROOM_COLOR)
        break
      case 3: // was CARPET → FLOOR_3 purple
        tileColors.push(DEFAULT_CARPET_COLOR)
        break
      case 4: // was DOORWAY → FLOOR_4 tan
        tileColors.push(DEFAULT_DOORWAY_COLOR)
        break
      default:
        // New tile types (5-7) without colors — use neutral gray
        tileColors.push(tile > 0 ? { h: 0, s: 0, b: 0, c: 0 } : null)
    }
  }

  return { ...layout, tileColors }
}

// ── Interaction Points ──────────────────────────────────────────

export interface InteractionPoint {
  col: number
  row: number
  facingDir: Direction
  furnitureType: string
}

/** Furniture types that idle characters can interact with — 15+ 种活动 */
const INTERACTABLE_TYPES = new Set([
  // 原有
  FurnitureType.COOLER, FurnitureType.WATER_COOLER,
  FurnitureType.BOOKSHELF, FurnitureType.LIBRARY_GRAY_FULL,
  FurnitureType.WHITEBOARD, FurnitureType.FRIDGE,
  FurnitureType.DECO_3,
  // 新增 — 让角色能做更多事
  FurnitureType.SOFA,           // 1. 坐沙发休息
  FurnitureType.PLANT,          // 2. 看植物/浇花
  FurnitureType.PLANT_SMALL,    // 3. 欣赏小盆栽
  FurnitureType.CLOCK,          // 4. 看时间
  FurnitureType.LAMP,           // 5. 站在灯旁思考
  FurnitureType.PAINTING_LARGE_1, // 6. 欣赏画作
  FurnitureType.PAINTING_LARGE_2, // 7. 欣赏画作
  FurnitureType.PAINTING_SMALL_1, // 8. 看小画
  FurnitureType.PHONE,          // 9. 打电话
  FurnitureType.COFFEE,         // 10. 喝咖啡
  FurnitureType.PC,             // 11. 看别人的电脑
  FurnitureType.PC_BACK,        // 12. 检查服务器机架
  FurnitureType.SERVER_RACK,    // 13. 巡检服务器
  FurnitureType.PING_PONG,      // 14. 打乒乓球
  FurnitureType.BASKETBALL,     // 15. 投篮
  FurnitureType.FITNESS,        // 16. 健身
  FurnitureType.VENDING,        // 17. 买饮料
])

/** Get interaction points adjacent to interactable furniture */
export function getInteractionPoints(
  furniture: PlacedFurniture[], tileMap: TileTypeVal[][], blockedTiles: Set<string>,
): InteractionPoint[] {
  const points: InteractionPoint[] = []
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry || !INTERACTABLE_TYPES.has(item.type as any)) continue
    // Check tiles along the bottom edge + 1 row below the furniture
    for (let dc = 0; dc < entry.footprintW; dc++) {
      const belowCol = Math.round(item.col + dc)
      const belowRow = Math.round(item.row + entry.footprintH)
      if (isWalkable(belowCol, belowRow, tileMap, blockedTiles)) {
        points.push({ col: belowCol, row: belowRow, facingDir: Direction.UP, furnitureType: item.type })
      }
    }
    // Check tiles along the left edge
    for (let dr = 0; dr < entry.footprintH; dr++) {
      const leftCol = Math.round(item.col - 1)
      const leftRow = Math.round(item.row + dr)
      if (isWalkable(leftCol, leftRow, tileMap, blockedTiles)) {
        points.push({ col: leftCol, row: leftRow, facingDir: Direction.RIGHT, furnitureType: item.type })
      }
    }
    // Check tiles along the right edge
    for (let dr = 0; dr < entry.footprintH; dr++) {
      const rightCol = Math.round(item.col + entry.footprintW)
      const rightRow = Math.round(item.row + dr)
      if (isWalkable(rightCol, rightRow, tileMap, blockedTiles)) {
        points.push({ col: rightCol, row: rightRow, facingDir: Direction.LEFT, furnitureType: item.type })
      }
    }
  }

  // Photograph interaction points — idle characters can stop to admire it
  for (let c = 12; c <= 14; c++) {
    if (isWalkable(c, 1, tileMap, blockedTiles)) {
      points.push({ col: c, row: 1, facingDir: Direction.UP, furnitureType: 'photograph' })
      points.push({ col: c, row: 1, facingDir: Direction.UP, furnitureType: 'photograph' })
    }
  }

  // 走廊散步 — 在中间走廊 (lr=8) 面朝不同方向
  const corridorRow = Math.floor(tileMap.length / 2)
  for (let c = 3; c < tileMap[0]?.length - 3; c += 4) {
    if (isWalkable(c, corridorRow, tileMap, blockedTiles)) {
      points.push({ col: c, row: corridorRow, facingDir: Direction.DOWN, furnitureType: 'corridor_walk' })
    }
  }

  // 窗边看风景 — 面朝墙壁（即窗户方向）
  // 左墙窗
  for (let r = 3; r < tileMap.length - 3; r += 3) {
    if (isWalkable(1, r, tileMap, blockedTiles)) {
      points.push({ col: 1, row: r, facingDir: Direction.LEFT, furnitureType: 'window_gaze' })
    }
  }
  // 右墙窗
  const maxCol = (tileMap[0]?.length || 36) - 2
  for (let r = 3; r < tileMap.length - 3; r += 3) {
    if (isWalkable(maxCol, r, tileMap, blockedTiles)) {
      points.push({ col: maxCol, row: r, facingDir: Direction.RIGHT, furnitureType: 'window_gaze' })
    }
  }

  return points
}

// ── Doorway Tiles ───────────────────────────────────────────────

/** Find all doorway (FLOOR_4) tiles in the layout */
export function getDoorwayTiles(layout: OfficeLayout): Array<{ col: number; row: number }> {
  const tiles: Array<{ col: number; row: number }> = []
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      if (layout.tiles[r * layout.cols + c] === TileType.FLOOR_4) {
        tiles.push({ col: c, row: r })
      }
    }
  }
  return tiles
}

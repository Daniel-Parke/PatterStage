// The `?mission=<id>` deep link is the destination of every "open the parent
// mission" affordance on the sessions surface. Those links used to point at
// `/work/missions/<id>`, a route this repository has never had, so
// all four of them 404'd. These cases pin the replacement's three outcomes,
// including the one that is easy to get wrong: a link to a mission that is
// gone must be distinguishable from no link at all, or the affordance goes
// back to silently doing nothing.

import {
  MISSIONS_PATH,
  resolveMissionDeepLink,
} from "@/lib/missions/mission-deep-link";

const MISSIONS = [{ id: "aaaa-1111" }, { id: "bbbb-2222" }];

describe("resolveMissionDeepLink", () => {
  it("opens a mission that is in the loaded list", () => {
    expect(
      resolveMissionDeepLink(
        `http://localhost:3000${MISSIONS_PATH}?mission=bbbb-2222`,
        MISSIONS,
      ),
    ).toEqual({ kind: "open", missionId: "bbbb-2222" });
  });

  it("reports a mission id that is no longer in the list", () => {
    expect(
      resolveMissionDeepLink(
        `http://localhost:3000${MISSIONS_PATH}?mission=deleted-9`,
        MISSIONS,
      ),
    ).toEqual({ kind: "missing", missionId: "deleted-9" });
  });

  it("is inert with no mission param, an empty one, or another param", () => {
    const base = `http://localhost:3000${MISSIONS_PATH}`;
    expect(resolveMissionDeepLink(base, MISSIONS)).toEqual({ kind: "none" });
    expect(resolveMissionDeepLink(`${base}?mission=`, MISSIONS)).toEqual({
      kind: "none",
    });
    expect(resolveMissionDeepLink(`${base}?template=t1`, MISSIONS)).toEqual({
      kind: "none",
    });
  });

  it("is inert on an unparseable href rather than throwing", () => {
    // The board must survive a broken URL. An affordance that can take the
    // whole page down is worse than the dead link it replaced.
    expect(resolveMissionDeepLink("not a url", MISSIONS)).toEqual({
      kind: "none",
    });
  });

  it("misses rather than opens when nothing has loaded yet", () => {
    expect(
      resolveMissionDeepLink(
        `http://localhost:3000${MISSIONS_PATH}?mission=aaaa-1111`,
        [],
      ),
    ).toEqual({ kind: "missing", missionId: "aaaa-1111" });
  });
});

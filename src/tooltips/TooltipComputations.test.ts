import { v4 as uuidv4 } from 'uuid';
import {
    trickSemiLogicSelector,
    trickSemiLogicTrickListSelector,
} from '../customization/Selectors';
import { mergeRequirements } from '../logic/bitlogic/BitLogic';
import type BooleanExpression from '../logic/booleanlogic/BooleanExpression';
import { logicSelector, optionsSelector } from '../logic/Selectors';
import { createTestLogic } from '../testing/TestingUtils';
import {
    allSettingsSelector,
    getRequirementLogicalStateSelector,
    settingsRequirementsSelector,
    settingsSelector,
} from '../tracker/Selectors';
import { acceptSettings } from '../tracker/Slice';
import { TooltipComputer } from './TooltipComputations';
import {
    booleanExprToTooltipExpr,
    type RootTooltipExpression,
    type TooltipExpression,
} from './TooltipExpression';

describe('tooltips', () => {
    const tester = createTestLogic();

    beforeAll(tester.beforeAll);

    function createComputer(): TooltipComputer {
        const logic = tester.readSelector(logicSelector);
        const options = tester.readSelector(optionsSelector);
        const settings = tester.readSelector(settingsSelector);
        const settingsRequirements = tester.readSelector(
            settingsRequirementsSelector,
        );
        const expertMode = tester.readSelector(trickSemiLogicSelector);
        const consideredTricks = tester.readSelector(
            trickSemiLogicTrickListSelector,
        );

        const bitLogic = mergeRequirements(
            logic.numRequirements,
            logic.staticRequirements,
            settingsRequirements,
        );
        return new TooltipComputer(
            logic,
            options,
            settings,
            expertMode,
            consideredTricks,
            bitLogic,
        );
    }

    async function getTooltipExpression(
        computer: TooltipComputer,
        checkId: string,
    ): Promise<RootTooltipExpression> {
        let expr: BooleanExpression | undefined;
        expr = computer.getSnapshot(checkId);
        if (!expr) {
            let doResolve: (() => void) | undefined;
            const resultPromise = new Promise<void>((resolve) => {
                doResolve = resolve;
            });
            // Results aren't available, so we need to await.
            // We only await once here, and thus verify there are no spurious wakeups.
            // React's useSyncExternalStore can deal with spurious wakeups but this
            // seems fine and I don't want to deal with more promises.
            const id = uuidv4();
            const unsubscribe = computer.subscribe(id, checkId, doResolve!);
            await resultPromise;
            expr = computer.getSnapshot(checkId);
            unsubscribe();
            expect(expr).toBeDefined();
        }

        return booleanExprToTooltipExpr(
            tester.readSelector(logicSelector),
            expr!,
            tester.readSelector(getRequirementLogicalStateSelector),
        );
    }

    function formatExpr(expr: TooltipExpression): string {
        if (expr.type === 'item') {
            return expr.item;
        } else {
            return `(${expr.items.map(formatExpr).join(` ${expr.op} `)})`;
        }
    }

    describe('all checks enabled', () => {
        let computer: TooltipComputer;
        beforeAll(() => {
            tester.beforeEach();

            const settings = tester.readSelector(allSettingsSelector);
            tester.dispatch(
                acceptSettings({
                    settings: { ...settings, 'excluded-locations': [] },
                }),
            );
            computer = createComputer();
        });

        it('computes Nothing', async () => {
            const result = await getTooltipExpression(
                computer,
                tester.findCheckId('Upper Skyloft', "Fledge's Gift"),
            );
            expect(formatExpr(result)).toMatchInlineSnapshot(`"(Nothing)"`);
        });

        it('computes Batreaux', async () => {
            const result = await getTooltipExpression(
                computer,
                tester.findCheckId("Batreaux's House", '30 Crystals Chest'),
            );
            expect(formatExpr(result)).toMatchInlineSnapshot(
                `"(30 Gratitude Crystals)"`,
            );
        });

        it('computes more complicated things', async () => {
            const result = await getTooltipExpression(
                computer,
                tester.findCheckId('Lanayru Desert', 'Rescue Caged Robot'),
            );
            expect(formatExpr(result)).toMatchInlineSnapshot(
                `"(Amber Tablet and (Bomb Bag or (Hook Beetle and (Bow or Practice Sword))))"`,
            );
        });

        it('computes goddess chest', async () => {
            const result = await getTooltipExpression(
                computer,
                tester.findCheckId(
                    'Sky',
                    "Cage\\Beedle's Island Cage Goddess Chest",
                ),
            );
            expect(formatExpr(result)).toMatchInlineSnapshot(
                `"(Goddess Cube on top of Skyview and (Beetle or Bow or Clawshots or Slingshot))"`,
            );
        });

        it('correctly factors out combinations', async () => {
            const result = await getTooltipExpression(
                computer,
                tester.findCheckId('Faron Woods', 'Deep Woods Chest'),
            );
            expect(formatExpr(result)).toMatchInlineSnapshot(
                `"(Emerald Tablet and (Clawshots or ((Bomb Bag or Practice Sword) and (Beetle or Bow or Slingshot))))"`,
            );
        });
    });
});

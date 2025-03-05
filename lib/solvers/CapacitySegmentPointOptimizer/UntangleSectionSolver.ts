import { BaseSolver } from "../BaseSolver"

/**
 * The UntangleSectionSolver optimizes a section of connected capacity nodes
 * with their deduplicated segments.
 *
 * The section always has a "root" node. From the root node, MUTABLE_HOPS are
 * taken to reach other nodes that are mutable. One additional hop is taken to
 * have all the impacted nodes in section. So a section is composed of mutable
 * and immutable nodes.
 *
 * The goal of the solver is to perform operations on the mutable nodes of the
 * section to lower the overall cost of the section.
 *
 * The untangle phase will perform "operations" on segments based on "issues"
 *
 * An "issue" is anything that increases the cost of the node:
 * - Anything that causes a via (e.g. layer transition)
 * - Any time two traces cross on the same layer
 *
 * An operation is a change to a segment. There are two main operations:
 * - Change layer
 * - Change point order on segment
 *
 * This solver works by exploring different paths of operations. When an
 * operation is performed, new issues are created. Each path has a cost, and
 * a set of neighbors representing next operations to perform.
 *
 */
export class UnravelSectionSolver extends BaseSolver {}

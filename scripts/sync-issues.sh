#!/bin/bash

# SAMS Issue Sync Helper
# Helps synchronize between GitHub Issues and markdown tracking system
# For solo developer workflow
#
# Label System (updated Jan 8, 2026):
#   Bug Severity:  blocker, regression, defect, nuisance, cleanup
#   Scheduling:    sprint-current, sprint-next, backlog
#   Type:          bug, enhancement, technical-debt

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
ORANGE='\033[0;33m'
NC='\033[0m' # No Color

# Label definitions (for reference and ensure_labels function)
# Bug Severity Labels
LABEL_BLOCKER="blocker"          # #d73a4a - System unusable, no workaround
LABEL_REGRESSION="regression"    # #ff6b6b - Was working, now broken
LABEL_DEFECT="defect"            # #ffc107 - Broken, workaround exists
LABEL_NUISANCE="nuisance"        # #a8dadc - Annoyance, not blocking
LABEL_CLEANUP="cleanup"          # #90ee90 - Tech debt, leftover code

# Scheduling Labels
LABEL_SPRINT_CURRENT="sprint-current"  # #d73a4a - In active sprint
LABEL_SPRINT_NEXT="sprint-next"        # #ffc107 - Queued for next sprint
LABEL_BACKLOG="backlog"                # #e0e0e0 - Not scheduled

function print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  SAMS Issue Sync Helper${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

function check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
        echo "Install it from: https://cli.github.com/"
        exit 1
    fi
    
    # Check if authenticated
    if ! gh auth status &> /dev/null; then
        echo -e "${YELLOW}GitHub CLI is not authenticated${NC}"
        echo "Run: gh auth login"
        exit 1
    fi
}

function show_menu() {
    echo "What would you like to do?"
    echo ""
    echo -e "${CYAN}=== View Issues ===${NC}"
    echo "1) List open GitHub Issues"
    echo "2) List open issues from markdown files"
    echo "3) Show current sprint issues"
    echo "4) Show high-severity items (blockers, regressions)"
    echo "5) Show weekly summary"
    echo ""
    echo -e "${CYAN}=== Create Issues ===${NC}"
    echo "6) Create quick bug issue"
    echo "7) Create quick enhancement issue"
    echo "8) Promote markdown to GitHub issue"
    echo ""
    echo -e "${CYAN}=== Manage Labels ===${NC}"
    echo "9) Ensure all labels exist"
    echo "10) Add issue to current sprint"
    echo "11) Move issue to next sprint"
    echo ""
    echo "q) Quit"
    echo ""
    read -p "Choose option: " choice
    
    case $choice in
        1) list_github_issues ;;
        2) list_markdown_issues ;;
        3) show_sprint_issues ;;
        4) show_high_severity ;;
        5) show_weekly_summary ;;
        6) create_quick_bug ;;
        7) create_quick_enhancement ;;
        8) promote_markdown_to_github ;;
        9) ensure_labels ;;
        10) add_to_sprint ;;
        11) move_to_next_sprint ;;
        q|Q) exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}" ; show_menu ;;
    esac
}

function list_github_issues() {
    echo -e "${GREEN}Open GitHub Issues:${NC}"
    echo ""
    gh issue list --limit 50 --state open
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function list_markdown_issues() {
    echo -e "${GREEN}Open Issues from Markdown Files:${NC}"
    echo ""
    
    if [ -d "$PROJECT_ROOT/docs/issues 2/open" ]; then
        cd "$PROJECT_ROOT/docs/issues 2/open"
        for file in *.md; do
            if [ -f "$file" ]; then
                # Extract priority and title from file
                priority=$(grep -m 1 "Priority:" "$file" | sed 's/.*Priority.*: //')
                title=$(echo "$file" | sed 's/ISSUE_//' | sed 's/CRITICAL_//' | sed 's/.md$//' | tr '_' ' ')
                echo -e "${YELLOW}${priority}${NC} - $title"
            fi
        done
    fi
    
    echo ""
    echo -e "${GREEN}Backlog from .apm/Implementation_Plan.md:${NC}"
    grep -A 3 "Status.*BACKLOG" "$PROJECT_ROOT/.apm/Implementation_Plan.md" 2>/dev/null | head -n 20 || echo "None found"
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function show_high_severity() {
    echo -e "${GREEN}High Severity Items (Blockers & Regressions):${NC}"
    echo ""
    
    echo -e "${RED}=== BLOCKERS (System unusable, no workaround) ===${NC}"
    gh issue list --label blocker --state open --limit 20 2>/dev/null || echo "  None"
    
    echo ""
    echo -e "${ORANGE}=== REGRESSIONS (Was working, now broken) ===${NC}"
    gh issue list --label regression --state open --limit 20 2>/dev/null || echo "  None"
    
    echo ""
    echo -e "${YELLOW}=== DEFECTS (Broken, workaround exists) ===${NC}"
    gh issue list --label defect --state open --limit 20 2>/dev/null || echo "  None"
    
    echo ""
    echo -e "${BLUE}=== Current Sprint ===${NC}"
    gh issue list --label sprint-current --state open --limit 20 2>/dev/null || echo "  None"
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function show_sprint_issues() {
    echo -e "${GREEN}Current Sprint Issues:${NC}"
    echo ""
    
    echo -e "${RED}=== SPRINT-CURRENT ===${NC}"
    gh issue list --label sprint-current --state open --limit 30
    
    echo ""
    echo -e "${YELLOW}=== SPRINT-NEXT (Queued) ===${NC}"
    gh issue list --label sprint-next --state open --limit 20 2>/dev/null || echo "  None"
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function show_weekly_summary() {
    echo -e "${GREEN}Weekly Summary:${NC}"
    echo ""
    
    echo -e "${BLUE}=== Scheduling Status ===${NC}"
    echo -n "  Sprint Current: "
    gh issue list --label sprint-current --state open --json number --jq 'length' 2>/dev/null || echo "0"
    echo -n "  Sprint Next: "
    gh issue list --label sprint-next --state open --json number --jq 'length' 2>/dev/null || echo "0"
    echo -n "  Backlog: "
    gh issue list --label backlog --state open --json number --jq 'length' 2>/dev/null || echo "0"
    
    echo ""
    echo -e "${BLUE}=== Bug Severity ===${NC}"
    echo -n "  Blockers: "
    gh issue list --label blocker --state open --json number --jq 'length' 2>/dev/null || echo "0"
    echo -n "  Regressions: "
    gh issue list --label regression --state open --json number --jq 'length' 2>/dev/null || echo "0"
    echo -n "  Defects: "
    gh issue list --label defect --state open --json number --jq 'length' 2>/dev/null || echo "0"
    echo -n "  Nuisances: "
    gh issue list --label nuisance --state open --json number --jq 'length' 2>/dev/null || echo "0"
    echo -n "  Cleanup: "
    gh issue list --label cleanup --state open --json number --jq 'length' 2>/dev/null || echo "0"
    
    echo ""
    echo -e "${BLUE}=== Issue Types ===${NC}"
    echo -n "  Bugs: "
    gh issue list --label bug --state open --json number --jq 'length' 2>/dev/null || echo "0"
    echo -n "  Enhancements: "
    gh issue list --label enhancement --state open --json number --jq 'length' 2>/dev/null || echo "0"
    echo -n "  Technical Debt: "
    gh issue list --label technical-debt --state open --json number --jq 'length' 2>/dev/null || echo "0"
    
    echo ""
    echo -e "${BLUE}=== Issues Closed This Week ===${NC}"
    # macOS-compatible date command (use -v instead of -d)
    seven_days_ago=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d 2>/dev/null || echo "2025-10-02")
    gh issue list --state closed --search "closed:>=$seven_days_ago" --limit 10 2>/dev/null || echo "  No issues closed this week"
    
    echo ""
    echo -e "${BLUE}=== Total Open ===${NC}"
    echo -n "  All open issues: "
    gh issue list --state open --json number --jq 'length' 2>/dev/null || echo "0"
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function create_quick_bug() {
    echo -e "${GREEN}Create Quick Bug Issue${NC}"
    echo ""
    
    read -p "Bug title: " title
    read -p "Description: " description
    
    echo ""
    echo "Bug Severity:"
    echo "  1) blocker    - System unusable, no workaround"
    echo "  2) regression - Was working, now broken"
    echo "  3) defect     - Broken, workaround exists"
    echo "  4) nuisance   - Annoyance, not blocking"
    echo "  5) cleanup    - Tech debt, leftover code"
    echo "  6) none       - No severity label"
    read -p "Choose severity (1-6): " severity_choice
    
    echo ""
    echo "Sprint Scheduling:"
    echo "  1) sprint-current - Add to active sprint"
    echo "  2) sprint-next    - Queue for next sprint"
    echo "  3) backlog        - Not scheduled yet"
    read -p "Choose scheduling (1-3): " schedule_choice
    
    labels="bug"
    
    case $severity_choice in
        1) labels="$labels,blocker" ;;
        2) labels="$labels,regression" ;;
        3) labels="$labels,defect" ;;
        4) labels="$labels,nuisance" ;;
        5) labels="$labels,cleanup" ;;
        6|*) ;; # No severity label
    esac
    
    case $schedule_choice in
        1) labels="$labels,sprint-current" ;;
        2) labels="$labels,sprint-next" ;;
        3|*) labels="$labels,backlog" ;;
    esac
    
    gh issue create \
        --title "[BUG] $title" \
        --body "$description" \
        --label "$labels"
    
    echo ""
    echo -e "${GREEN}Issue created successfully!${NC}"
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function create_quick_enhancement() {
    echo -e "${GREEN}Create Quick Enhancement Issue${NC}"
    echo ""
    
    read -p "Enhancement title: " title
    read -p "User story: " story
    
    echo ""
    echo "Effort Estimate:"
    echo "  1) quick-win      - Less than 2 hours"
    echo "  2) feature        - 2-8 hours"
    echo "  3) infrastructure - Developer/system improvement"
    echo "  4) none           - No effort label"
    read -p "Choose effort (1-4): " effort_choice
    
    echo ""
    echo "Sprint Scheduling:"
    echo "  1) sprint-current - Add to active sprint"
    echo "  2) sprint-next    - Queue for next sprint"
    echo "  3) backlog        - Not scheduled yet"
    read -p "Choose scheduling (1-3): " schedule_choice
    
    labels="enhancement"
    
    case $effort_choice in
        1) labels="$labels,quick-win" ;;
        2) labels="$labels,feature" ;;
        3) labels="$labels,infrastructure" ;;
        4|*) ;; # No effort label
    esac
    
    case $schedule_choice in
        1) labels="$labels,sprint-current" ;;
        2) labels="$labels,sprint-next" ;;
        3|*) labels="$labels,backlog" ;;
    esac
    
    body="## User Story
$story

## Business Value
[To be filled]

## Acceptance Criteria
- [ ] Feature implemented
- [ ] Testing completed
- [ ] Documentation updated"
    
    gh issue create \
        --title "[ENHANCEMENT] $title" \
        --body "$body" \
        --label "$labels"
    
    echo ""
    echo -e "${GREEN}Issue created successfully!${NC}"
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function promote_markdown_to_github() {
    echo -e "${GREEN}Promote Markdown Issue to GitHub${NC}"
    echo ""
    
    if [ ! -d "$PROJECT_ROOT/docs/issues 2/open" ]; then
        echo -e "${RED}No markdown issues directory found${NC}"
        read -p "Press enter to continue..."
        show_menu
        return
    fi
    
    cd "$PROJECT_ROOT/docs/issues 2/open"
    echo "Available markdown issues:"
    echo ""
    select file in *.md; do
        if [ -n "$file" ]; then
            echo ""
            echo "Preview of $file:"
            echo "---"
            head -n 20 "$file"
            echo "---"
            echo ""
            read -p "Create GitHub issue from this file? (y/n): " confirm
            
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                # Extract info from markdown file
                title=$(grep -m 1 "^# " "$file" | sed 's/# //')
                priority=$(grep -m 1 "Priority:" "$file" | sed 's/.*Priority.*: //' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z-]//g')
                
                # Determine labels based on priority (map old to new)
                labels="bug"
                if [[ "$priority" == *"critical"* ]] || [[ "$priority" == *"blocker"* ]]; then
                    labels="$labels,blocker,sprint-current"
                elif [[ "$priority" == *"high"* ]] || [[ "$priority" == *"regression"* ]]; then
                    labels="$labels,regression,sprint-current"
                elif [[ "$priority" == *"medium"* ]]; then
                    labels="$labels,defect,sprint-next"
                elif [[ "$priority" == *"low"* ]]; then
                    labels="$labels,nuisance,backlog"
                else
                    labels="$labels,backlog"
                fi
                
                # Create issue with file content as body
                gh issue create \
                    --title "$title" \
                    --body-file "$file" \
                    --label "$labels"
                
                echo ""
                echo -e "${GREEN}GitHub issue created successfully!${NC}"
                echo "You may want to update .apm/Implementation_Plan.md"
            fi
            break
        fi
    done
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function ensure_labels() {
    echo -e "${GREEN}Ensuring All Labels Exist${NC}"
    echo ""
    
    echo "Creating/verifying bug severity labels..."
    gh label create "blocker" --color "d73a4a" --description "System unusable, no workaround" 2>/dev/null && echo "  Created: blocker" || echo "  Exists: blocker"
    gh label create "regression" --color "ff6b6b" --description "Was working, now broken" 2>/dev/null && echo "  Created: regression" || echo "  Exists: regression"
    gh label create "defect" --color "ffc107" --description "Functionality broken, workaround exists" 2>/dev/null && echo "  Created: defect" || echo "  Exists: defect"
    gh label create "nuisance" --color "a8dadc" --description "Annoyance, not blocking work" 2>/dev/null && echo "  Created: nuisance" || echo "  Exists: nuisance"
    gh label create "cleanup" --color "90ee90" --description "Tech debt from workarounds, leftover code" 2>/dev/null && echo "  Created: cleanup" || echo "  Exists: cleanup"
    
    echo ""
    echo "Creating/verifying scheduling labels..."
    gh label create "sprint-current" --color "d73a4a" --description "In active sprint" 2>/dev/null && echo "  Created: sprint-current" || echo "  Exists: sprint-current"
    gh label create "sprint-next" --color "ffc107" --description "Queued for next sprint" 2>/dev/null && echo "  Created: sprint-next" || echo "  Exists: sprint-next"
    # backlog should already exist from default labels
    
    echo ""
    echo "Creating/verifying enhancement labels..."
    gh label create "quick-win" --color "28a745" --description "Less than 2 hours, high user value" 2>/dev/null && echo "  Created: quick-win" || echo "  Exists: quick-win"
    gh label create "feature" --color "0366d6" --description "New capability, 2-8 hours" 2>/dev/null && echo "  Created: feature" || echo "  Exists: feature"
    gh label create "infrastructure" --color "6f42c1" --description "Developer/system improvement" 2>/dev/null && echo "  Created: infrastructure" || echo "  Exists: infrastructure"
    gh label create "stretch-goal" --color "e0e0e0" --description "Nice-to-have, defer if tight" 2>/dev/null && echo "  Created: stretch-goal" || echo "  Exists: stretch-goal"
    
    echo ""
    echo -e "${GREEN}All labels verified!${NC}"
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function add_to_sprint() {
    echo -e "${GREEN}Add Issue to Current Sprint${NC}"
    echo ""
    
    read -p "Issue number to add to sprint: " issue_num
    
    if [ -z "$issue_num" ]; then
        echo -e "${RED}No issue number provided${NC}"
        read -p "Press enter to continue..."
        show_menu
        return
    fi
    
    # Remove from other sprint labels and add to current
    gh issue edit "$issue_num" --remove-label "sprint-next,backlog" 2>/dev/null
    gh issue edit "$issue_num" --add-label "sprint-current"
    
    echo ""
    echo -e "${GREEN}Issue #$issue_num added to current sprint!${NC}"
    gh issue view "$issue_num" --json labels --jq '.labels[].name' | tr '\n' ', '
    echo ""
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function move_to_next_sprint() {
    echo -e "${GREEN}Move Issue to Next Sprint${NC}"
    echo ""
    
    read -p "Issue number to move to next sprint: " issue_num
    
    if [ -z "$issue_num" ]; then
        echo -e "${RED}No issue number provided${NC}"
        read -p "Press enter to continue..."
        show_menu
        return
    fi
    
    # Remove from current sprint and add to next
    gh issue edit "$issue_num" --remove-label "sprint-current,backlog" 2>/dev/null
    gh issue edit "$issue_num" --add-label "sprint-next"
    
    echo ""
    echo -e "${GREEN}Issue #$issue_num moved to next sprint!${NC}"
    gh issue view "$issue_num" --json labels --jq '.labels[].name' | tr '\n' ', '
    echo ""
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

# Main execution
print_header
check_gh_cli
show_menu


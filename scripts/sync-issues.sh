#!/bin/bash

# SAMS Issue Sync Helper
# Helps synchronize between GitHub Issues and markdown tracking system
# For solo developer workflow

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    echo "1) List open GitHub Issues"
    echo "2) List open issues from markdown files"
    echo "3) Create GitHub Issue from markdown file"
    echo "4) Show high-priority items (all sources)"
    echo "5) Show weekly summary"
    echo "6) Create quick bug issue"
    echo "7) Create quick enhancement issue"
    echo "q) Quit"
    echo ""
    read -p "Choose option: " choice
    
    case $choice in
        1) list_github_issues ;;
        2) list_markdown_issues ;;
        3) promote_markdown_to_github ;;
        4) show_high_priority ;;
        5) show_weekly_summary ;;
        6) create_quick_bug ;;
        7) create_quick_enhancement ;;
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

function show_high_priority() {
    echo -e "${GREEN}High Priority Items (All Sources):${NC}"
    echo ""
    
    echo -e "${BLUE}=== GitHub Issues ===${NC}"
    gh issue list --label high-priority,critical --state open --limit 20
    
    echo ""
    echo -e "${BLUE}=== Markdown Files ===${NC}"
    grep -r "Priority.*HIGH\|Priority.*CRITICAL" "$PROJECT_ROOT/docs/issues 2/open/" 2>/dev/null || echo "None found"
    
    echo ""
    echo -e "${BLUE}=== Master Tracker ===${NC}"
    grep -A 2 "CRITICAL\|HIGH PRIORITY" "$PROJECT_ROOT/.apm/Implementation_Plan.md" | head -n 30
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function show_weekly_summary() {
    echo -e "${GREEN}Weekly Summary:${NC}"
    echo ""
    
    echo -e "${BLUE}Open GitHub Issues by Label:${NC}"
    echo -n "  Critical: "
    gh issue list --label critical --state open --json number --jq 'length'
    echo -n "  High Priority: "
    gh issue list --label high-priority --state open --json number --jq 'length'
    echo -n "  Bugs: "
    gh issue list --label bug --state open --json number --jq 'length'
    echo -n "  Enhancements: "
    gh issue list --label enhancement --state open --json number --jq 'length'
    echo -n "  Technical Debt: "
    gh issue list --label technical-debt --state open --json number --jq 'length'
    
    echo ""
    echo -e "${BLUE}Issues Closed This Week:${NC}"
    # macOS-compatible date command (use -v instead of -d)
    seven_days_ago=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d 2>/dev/null || echo "2025-10-02")
    gh issue list --state closed --search "closed:>=$seven_days_ago" --limit 10 2>/dev/null || echo "  No issues closed this week"
    
    echo ""
    echo -e "${BLUE}Technical Debt & Issues from .apm/Implementation_Plan.md:${NC}"
    # Count CRITICAL issues
    critical_count=$(grep -c "^### CRITICAL-" "$PROJECT_ROOT/.apm/Implementation_Plan.md" 2>/dev/null || echo "0")
    echo "  Critical issues: $critical_count"
    # Count HIGH priority issues  
    high_count=$(grep -c "^### HIGH-\|^### FORMER HIGH-" "$PROJECT_ROOT/.apm/Implementation_Plan.md" 2>/dev/null || echo "0")
    echo "  High priority issues: $high_count"
    # Count MEDIUM priority issues
    medium_count=$(grep -c "^### MEDIUM-" "$PROJECT_ROOT/.apm/Implementation_Plan.md" 2>/dev/null || echo "0")
    echo "  Medium priority issues: $medium_count"
    # Count ENHANCEMENTS
    enh_count=$(grep -c "^### ENHANCEMENT-" "$PROJECT_ROOT/.apm/Implementation_Plan.md" 2>/dev/null || echo "0")
    echo "  Enhancements tracked: $enh_count"
    
    echo ""
    read -p "Press enter to continue..."
    show_menu
}

function create_quick_bug() {
    echo -e "${GREEN}Create Quick Bug Issue${NC}"
    echo ""
    
    read -p "Bug title: " title
    read -p "Description: " description
    read -p "Priority (critical/high/medium/low): " priority
    
    labels="bug"
    if [ ! -z "$priority" ]; then
        labels="$labels,${priority}-priority"
    fi
    
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
    read -p "Priority (high/medium/low): " priority
    
    labels="enhancement"
    if [ ! -z "$priority" ]; then
        labels="$labels,${priority}-priority"
    fi
    
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
                
                # Determine labels based on priority
                labels="bug"
                if [[ "$priority" == *"critical"* ]]; then
                    labels="$labels,critical"
                elif [[ "$priority" == *"high"* ]]; then
                    labels="$labels,high-priority"
                elif [[ "$priority" == *"medium"* ]]; then
                    labels="$labels,medium-priority"
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

# Main execution
print_header
check_gh_cli
show_menu


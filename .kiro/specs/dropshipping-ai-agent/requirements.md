# Requirements Document

## Introduction

This document outlines the requirements for building an autonomous dropshipping AI agent that manages entire ecommerce brands. The agent is based on Andon Labs' Vending-Bench architecture and operates over long time horizons (20M+ tokens) to handle product selection, marketing, campaign management, and scaling decisions autonomously. The agent simulates daily operations with financial constraints and must maintain profitability while avoiding bankruptcy.

## Requirements

### Requirement 1

**User Story:** As a dropshipping entrepreneur, I want an autonomous agent that can manage my entire ecommerce business, so that I can scale operations without constant manual oversight.

#### Acceptance Criteria

1. WHEN the agent is initialized THEN it SHALL start with configurable initial capital (default $500)
2. WHEN the agent operates daily THEN it SHALL deduct daily ad spend fees (default $50)
3. WHEN the agent's net worth goes negative for 10+ consecutive days THEN it SHALL declare bankruptcy and stop operations
4. WHEN the agent makes decisions THEN it SHALL maintain context over 30,000+ tokens for long-term coherence
5. IF the agent encounters errors THEN it SHALL implement recovery mechanisms to prevent cascade failures

### Requirement 2

**User Story:** As a business owner, I want the agent to autonomously research and select profitable products, so that I can maintain competitive margins without manual product hunting.

#### Acceptance Criteria

1. WHEN searching for products THEN the agent SHALL analyze products from multiple sources (AliExpress, Amazon, etc.)
2. WHEN evaluating products THEN it SHALL calculate potential margins with 2-3x markup requirements
3. WHEN analyzing products THEN it SHALL assess content availability scores for marketing potential
4. WHEN selecting products THEN it SHALL verify supplier inventory before scaling
5. IF a product shows low profitability THEN the agent SHALL reject it and continue searching

### Requirement 3

**User Story:** As a marketer, I want the agent to create and test multiple marketing angles for each product, so that I can maximize conversion rates across different audiences.

#### Acceptance Criteria

1. WHEN launching a new product THEN the agent SHALL generate at least 3 different marketing angles
2. WHEN creating angles THEN it SHALL use scientific creative processes to find untapped mini-niches
3. WHEN testing angles THEN it SHALL run campaigns with structured A/B testing
4. WHEN an angle underperforms THEN it SHALL kill the campaign and try alternative approaches
5. IF all angles fail after testing THEN the agent SHALL discontinue the product

### Requirement 4

**User Story:** As a performance marketer, I want the agent to manage ad campaigns across multiple platforms, so that I can optimize reach and ROI without manual campaign management.

#### Acceptance Criteria

1. WHEN creating campaigns THEN the agent SHALL support Facebook, TikTok, and Google platforms
2. WHEN setting budgets THEN it SHALL never exceed available capital limits
3. WHEN monitoring performance THEN it SHALL maintain minimum ROAS of 1.5-1.7 for breakeven
4. WHEN campaigns perform well THEN it SHALL automatically scale winning campaigns
5. WHEN campaigns underperform THEN it SHALL kill losing campaigns to prevent losses

### Requirement 5

**User Story:** As a business analyst, I want the agent to track comprehensive metrics and financial performance, so that I can understand business health and make informed decisions.

#### Acceptance Criteria

1. WHEN operating daily THEN the agent SHALL track net worth, revenue, spend, and ROAS
2. WHEN campaigns run THEN it SHALL monitor real-time performance metrics
3. WHEN making decisions THEN it SHALL log all actions with reasoning and expected outcomes
4. WHEN day ends THEN it SHALL generate daily performance summaries
5. IF financial metrics decline THEN the agent SHALL implement conservative strategies

### Requirement 6

**User Story:** As a system administrator, I want the agent to maintain long-term memory and context, so that it can make coherent decisions over extended periods.

#### Acceptance Criteria

1. WHEN making decisions THEN the agent SHALL access scratchpad memory for recent context
2. WHEN storing information THEN it SHALL use key-value storage for structured data
3. WHEN searching memory THEN it SHALL support semantic vector search capabilities
4. WHEN memory grows large THEN it SHALL prune old memories (30+ days) to prevent overflow
5. IF context window fills THEN the agent SHALL maintain most recent relevant messages

### Requirement 7

**User Story:** As a risk manager, I want the agent to implement error recovery and circuit breakers, so that system failures don't cascade into business-critical losses.

#### Acceptance Criteria

1. WHEN errors occur THEN the agent SHALL implement recovery strategies specific to error types
2. WHEN error count exceeds threshold (10 errors) THEN it SHALL enter recovery mode
3. WHEN in recovery mode THEN it SHALL kill all campaigns and wait for cooldown period
4. WHEN financial errors occur THEN it SHALL reduce budgets and kill underperforming campaigns
5. IF product errors occur THEN the agent SHALL re-analyze all current products

### Requirement 8

**User Story:** As a business owner, I want the agent to simulate realistic daily operations, so that I can test strategies without risking real capital.

#### Acceptance Criteria

1. WHEN simulation starts THEN the agent SHALL run configurable number of days (default 200)
2. WHEN each day begins THEN it SHALL execute morning routine with metrics checking
3. WHEN making daily decisions THEN it SHALL limit actions per day (max 50) to prevent loops
4. WHEN day ends THEN it SHALL execute evening routine with campaign optimization
5. IF bankruptcy occurs THEN the simulation SHALL stop and report final results

### Requirement 9

**User Story:** As a developer, I want the agent to provide comprehensive tool integration, so that it can interact with external services and APIs effectively.

#### Acceptance Criteria

1. WHEN searching products THEN the agent SHALL integrate with ecommerce platform APIs
2. WHEN analyzing competitors THEN it SHALL access social media advertising intelligence tools
3. WHEN managing campaigns THEN it SHALL integrate with Facebook, TikTok, and Google Ads APIs
4. WHEN processing orders THEN it SHALL track delivery status with supplier systems
5. IF API calls fail THEN the agent SHALL implement retry logic and fallback strategies

### Requirement 10

**User Story:** As a quality assurance engineer, I want the agent to maintain decision coherence and prevent common failure patterns, so that it operates reliably over long periods.

#### Acceptance Criteria

1. WHEN tracking orders THEN the agent SHALL verify delivery status with suppliers, not assumptions
2. WHEN making decisions THEN it SHALL log structured decision data with reasoning
3. WHEN errors cascade THEN it SHALL implement circuit breakers to prevent system-wide failures
4. WHEN memory becomes inconsistent THEN it SHALL maintain decision tracking for coherence
5. IF the agent becomes confused THEN it SHALL reset to conservative operational mode
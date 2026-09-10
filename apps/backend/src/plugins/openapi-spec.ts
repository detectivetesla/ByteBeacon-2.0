/**
 * Authoritative OpenAPI 3.1 Specification for ByteBeacon 2.0 API.
 * Defines comprehensive paths, components, request/response models,
 * and security schemes across Telecom Prechecks, Asynchronous Jobs,
 * Order Dispatch, Approvals, Catalog, Wallet, and Webhooks.
 */

export const openApiPaths: Record<string, any> = {
  // 1. MTN / TELECOM BENEFICIARY PRECHECK
  '/api/v1/orders/beneficiaries/precheck': {
    post: {
      tags: ['Beneficiaries & Up2U'],
      summary: 'Public Recipient Precheck (Up2U Eligibility)',
      description:
        'Rapidly check Ghanaian mobile numbers for Up2U eligibility. Classifies recipients into APPROVED, UNAPPROVED/NEW, or REJECTED/INVALID with sub-second response times.',
      operationId: 'publicPrecheckBeneficiaries',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['network', 'phoneNumbers'],
              properties: {
                network: {
                  type: 'string',
                  enum: ['MTN', 'TELECEL', 'AIRTELTIGO'],
                  example: 'MTN',
                  description: 'Target telecom network provider',
                },
                phoneNumbers: {
                  type: 'array',
                  items: { type: 'string', example: '0241112233' },
                  description: 'Array of Ghanaian MSISDNs (max 500 numbers per batch)',
                },
                record: {
                  type: 'boolean',
                  default: true,
                  description: 'When true, logs unapproved numbers to Pending Approvals queue for subsequent processing',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Precheck completed successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PrecheckResponse' },
            },
          },
        },
        '400': { description: 'Bad Request - invalid phone format or missing network' },
        '429': { description: 'Rate Limit Exceeded' },
      },
    },
  },

  '/api/v1/beneficiaries/precheck': {
    post: {
      tags: ['Beneficiaries & Up2U'],
      summary: 'High-Capacity Beneficiary Precheck',
      description:
        'High-capacity recipient precheck supporting up to 1,000 numbers per request, authenticated caller attribution, and explicit cache bypass.',
      operationId: 'highCapacityPrecheck',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['network', 'phoneNumbers'],
              properties: {
                network: { type: 'string', enum: ['MTN', 'TELECEL', 'AIRTELTIGO'], example: 'MTN' },
                phoneNumbers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of recipient numbers (up to 1,000)',
                },
                record: {
                  type: 'boolean',
                  default: false,
                  description: 'Opt-in to record unapproved numbers to Pending Approvals',
                },
                bypassCache: {
                  type: 'boolean',
                  default: false,
                  description: 'Bypass cached Redis validation states to query the telecom gateway live',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'High-capacity precheck evaluated',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PrecheckResponse' },
            },
          },
        },
      },
    },
  },

  '/api/v1/agent/beneficiaries/precheck': {
    post: {
      tags: ['Beneficiaries & Up2U'],
      summary: 'Agent Reseller Beneficiary Precheck',
      description:
        'Authoritative Up2U precheck endpoint for integrated third-party platforms and agents, executing via high-speed upstream telecom pipe.',
      operationId: 'agentPrecheckBeneficiaries',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['network', 'phoneNumbers'],
              properties: {
                network: { type: 'string', enum: ['MTN', 'TELECEL', 'AIRTELTIGO'], example: 'MTN' },
                phoneNumbers: { type: 'array', items: { type: 'string' } },
                record: { type: 'boolean', default: false },
                bypassCache: { type: 'boolean', default: false },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Agent precheck successful',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PrecheckResponse' },
            },
          },
        },
      },
    },
  },

  // 2. ASYNCHRONOUS VERIFICATION JOBS
  '/api/v1/beneficiaries/verification-jobs': {
    post: {
      tags: ['Beneficiaries & Up2U'],
      summary: 'Initiate High-Speed Asynchronous Verification Job',
      description:
        'Submits up to 10,000 phone numbers for asynchronous background verification. Returns HTTP 202 Accepted with a unique Job ID, processing 500-1,000 rows per second.',
      operationId: 'createVerificationJob',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['network', 'phoneNumbers'],
              properties: {
                network: { type: 'string', enum: ['MTN', 'TELECEL', 'AIRTELTIGO'], example: 'MTN' },
                phoneNumbers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of up to 10,000 phone numbers to verify',
                },
                record: { type: 'boolean', default: false },
                idempotencyKey: {
                  type: 'string',
                  description: 'Optional unique client key to prevent duplicate job executions',
                },
              },
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'Verification job accepted and running in background',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VerificationJobState' },
            },
          },
        },
        '200': {
          description: 'Idempotent replay: previously completed job returned immediately',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VerificationJobState' },
            },
          },
        },
      },
    },
  },

  '/api/v1/beneficiaries/verification-jobs/{jobId}': {
    get: {
      tags: ['Beneficiaries & Up2U'],
      summary: 'Get Verification Job Status & Progress',
      description:
        'Poll real-time progress for a verification job, including processed count, percentage, summary counts (approved, unapproved, rejected), and full recipient results.',
      operationId: 'getVerificationJob',
      parameters: [
        {
          name: 'jobId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'The unique verification job identifier',
        },
      ],
      responses: {
        '200': {
          description: 'Current job state and results',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VerificationJobState' },
            },
          },
        },
        '404': { description: 'Job not found' },
      },
    },
  },

  '/api/v1/beneficiaries/verification-jobs/{jobId}/cancel': {
    post: {
      tags: ['Beneficiaries & Up2U'],
      summary: 'Cancel Active Verification Job',
      description: 'Aborts a running asynchronous verification job and stops further upstream requests.',
      operationId: 'cancelVerificationJob',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        {
          name: 'jobId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'Job cancellation acknowledged',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    properties: {
                      jobId: { type: 'string' },
                      status: { type: 'string', example: 'CANCELLED' },
                      cancelled: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  // 3. PENDING MTN APPROVALS MANAGEMENT
  '/api/v1/beneficiaries/approvals': {
    get: {
      tags: ['Pending Approvals'],
      summary: 'List Pending Beneficiary Approvals',
      description:
        'Retrieve a paginated list of pending beneficiary registrations and approvals with status and network filters.',
      operationId: 'listBeneficiaryApprovals',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'network', in: 'query', schema: { type: 'string' }, description: 'MTN, TELECEL, etc.' },
        { name: 'status', in: 'query', schema: { type: 'string' }, description: 'PENDING, APPROVED, REJECTED' },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        '200': {
          description: 'Paginated list of pending approvals',
        },
      },
    },
    delete: {
      tags: ['Pending Approvals'],
      summary: 'Bulk Delete / Clear All Pending Approvals',
      description:
        'Clears all pending approval records in the system (or filtered by network and status) for the authenticated agent/customer.',
      operationId: 'deleteAllBeneficiaryApprovals',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'network', in: 'query', schema: { type: 'string' }, description: 'Filter deletion by network' },
        { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter deletion by status' },
      ],
      responses: {
        '200': {
          description: 'Records cleared successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    properties: {
                      deletedCount: { type: 'integer', example: 193 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  '/api/v1/beneficiaries/approvals/{id}': {
    delete: {
      tags: ['Pending Approvals'],
      summary: 'Delete Single Pending Approval',
      description: 'Removes an individual pending approval record by ID.',
      operationId: 'deleteBeneficiaryApproval',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': { description: 'Record deleted successfully' },
        '404': { description: 'Record not found' },
      },
    },
  },

  '/api/v1/beneficiaries/pending-count': {
    get: {
      tags: ['Pending Approvals'],
      summary: 'Get Pending Approvals Count',
      description: 'Returns real-time count of pending approvals for badge indicators and navigation bars.',
      operationId: 'getPendingApprovalsCount',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Pending count',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      pendingCount: { type: 'integer', example: 193 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  // 4. ORDER DISPATCH (SINGLE & BULK)
  '/api/v1/agent/orders': {
    post: {
      tags: ['Orders'],
      summary: 'Create Single Data Bundle Order (Dispatch)',
      description:
        'Dispatches an automated telecom data bundle to a customer beneficiary MSISDN. Debits wallet balance in real time and enforces idempotency.',
      operationId: 'createAgentOrder',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID v4 to prevent double-charging on network retry',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['bundleId', 'phoneNumber', 'network'],
              properties: {
                bundleId: { type: 'string', example: 'mtn_10gb_promo' },
                phoneNumber: { type: 'string', example: '0241112233' },
                network: { type: 'string', enum: ['MTN', 'TELECEL', 'AIRTELTIGO'], example: 'MTN' },
                idempotencyKey: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Order created and queued for automated fulfillment',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderEnvelope' },
            },
          },
        },
        '400': { description: 'Invalid phone number or bundle ID' },
        '402': { description: 'Insufficient wallet float balance' },
      },
    },
    get: {
      tags: ['Orders'],
      summary: 'List Agent Orders',
      description: 'Fetch paginated historical orders placed by the authenticated agent with status and date filters.',
      operationId: 'listAgentOrders',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'status', in: 'query', schema: { type: 'string' } },
        { name: 'network', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': { description: 'List of orders' },
      },
    },
  },

  '/api/v1/agent/orders/{id}': {
    get: {
      tags: ['Orders'],
      summary: 'Query Order Status by ID',
      description: 'Fetch real-time fulfillment status, telecom reference, and delivery timestamps for a specific order.',
      operationId: 'getAgentOrderById',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'ORD-99214' },
      ],
      responses: {
        '200': {
          description: 'Order status details',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderEnvelope' },
            },
          },
        },
        '404': { description: 'Order not found' },
      },
    },
  },

  '/api/v1/agent/orders/bulk': {
    post: {
      tags: ['Orders'],
      summary: 'High-Throughput Bulk Order Dispatch',
      description:
        'Submits a batch of data bundle dispatches in a single atomic transaction. Validates float balance and dispatches fulfillment asynchronously.',
      operationId: 'createBulkOrders',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['network', 'recipients'],
              properties: {
                network: { type: 'string', enum: ['MTN', 'TELECEL', 'AIRTELTIGO'], example: 'MTN' },
                recipients: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['phoneNumber', 'bundleId'],
                    properties: {
                      phoneNumber: { type: 'string', example: '0241112233' },
                      bundleId: { type: 'string', example: 'mtn_10gb_promo' },
                      pricePesewas: { type: 'integer' },
                    },
                  },
                },
                idempotencyKey: { type: 'string' },
                onUnvalidated: {
                  type: 'string',
                  enum: ['HOLD_FOR_APPROVAL', 'REJECT_ALL', 'CONTINUE_VALID_ONLY'],
                  default: 'HOLD_FOR_APPROVAL',
                },
              },
            },
          },
        },
      },
      responses: {
        '202': { description: 'Bulk order accepted for processing' },
        '402': { description: 'Insufficient balance for bulk dispatch' },
      },
    },
  },

  // 5. CATALOG & BUNDLES
  '/api/v1/agent/bundles': {
    get: {
      tags: ['Catalog'],
      summary: 'Query Available Data Bundles (Agent Pricing)',
      description:
        'Returns active data bundle packages, volume limits, and wholesale agent prices across supported networks.',
      operationId: 'getAgentBundles',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'network', in: 'query', schema: { type: 'string', enum: ['MTN', 'TELECEL', 'AIRTELTIGO', 'ALL'] } },
      ],
      responses: {
        '200': {
          description: 'Available bundle packages',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'SUCCESS' },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/BundleItem' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  '/api/v1/catalog/products': {
    get: {
      tags: ['Catalog'],
      summary: 'List Catalog Products',
      description: 'Retrieve public or agent-tailored catalog products based on caller authorization.',
      operationId: 'listCatalogProducts',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      responses: {
        '200': { description: 'Active catalog products' },
      },
    },
  },

  // 6. WALLET & USAGE TELEMETRY
  '/api/v1/agent/wallet/balance': {
    get: {
      tags: ['Wallet & Telemetry'],
      summary: 'Get Prepaid Wallet Balance',
      description: 'Query current float balance, currency, and account standing in pesewas and formatted GHS.',
      operationId: 'getWalletBalance',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Wallet balance details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'SUCCESS' },
                  data: {
                    type: 'object',
                    properties: {
                      balancePesewas: { type: 'integer', example: 145000 },
                      formattedBalance: { type: 'string', example: 'GH₵ 1,450.00' },
                      currency: { type: 'string', example: 'GHS' },
                      accountStatus: { type: 'string', example: 'ACTIVE' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  '/api/v1/agent/api-usage': {
    get: {
      tags: ['Wallet & Telemetry'],
      summary: 'Query API Usage & Telemetry Metrics',
      description:
        'Returns request volume, average response times, error rates, and per-endpoint latency metrics for the authenticated API key.',
      operationId: 'getApiUsageMetrics',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Telemetry metrics and invocation breakdown',
        },
      },
    },
  },

  // 7. WEBHOOKS
  '/api/v1/webhooks': {
    post: {
      tags: ['Webhooks'],
      summary: 'Register Webhook Endpoint',
      description: 'Configures a URL to receive real-time order completion and status change notifications.',
      operationId: 'registerWebhook',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['url', 'events'],
              properties: {
                url: { type: 'string', format: 'uri', example: 'https://your-domain.com/webhooks/bytebeacon' },
                events: {
                  type: 'array',
                  items: { type: 'string', example: 'order.completed' },
                },
                secret: { type: 'string', description: 'Optional custom HMAC secret' },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Webhook registered successfully' },
      },
    },
    get: {
      tags: ['Webhooks'],
      summary: 'List Registered Webhooks',
      description: 'Returns all configured webhook subscriptions and their delivery status.',
      operationId: 'listWebhooks',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      responses: {
        '200': { description: 'Active webhook subscriptions' },
      },
    },
  },
};

export const openApiSchemas: Record<string, any> = {
  PrecheckResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      statusCode: { type: 'integer', example: 200 },
      message: { type: 'string', example: 'Success' },
      data: {
        type: 'object',
        properties: {
          network: { type: 'string', example: 'MTN' },
          enforced: { type: 'boolean', example: true },
          summary: {
            type: 'object',
            properties: {
              total: { type: 'integer', example: 476 },
              approved: { type: 'integer', example: 282 },
              unapproved: { type: 'integer', example: 193 },
              rejected: { type: 'integer', example: 1 },
            },
          },
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                phone: { type: 'string', example: '0241112233' },
                normalized: { type: 'string', example: '+233241112233' },
                status: { type: 'string', enum: ['APPROVED', 'UNAPPROVED', 'REJECTED'], example: 'APPROVED' },
                valid: { type: 'boolean', example: true },
                known: { type: 'boolean', example: true },
              },
            },
          },
        },
      },
    },
  },

  VerificationJobState: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'job_01J123456789' },
      network: { type: 'string', example: 'MTN' },
      status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'], example: 'COMPLETED' },
      totalRows: { type: 'integer', example: 476 },
      processedRows: { type: 'integer', example: 476 },
      percent: { type: 'number', example: 100 },
      approvedCount: { type: 'integer', example: 282 },
      unapprovedCount: { type: 'integer', example: 193 },
      rejectedCount: { type: 'integer', example: 1 },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            phone: { type: 'string', example: '0241112233' },
            status: { type: 'string', example: 'APPROVED' },
            valid: { type: 'boolean', example: true },
          },
        },
      },
      createdAt: { type: 'string', format: 'date-time' },
      completedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  OrderEnvelope: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'SUCCESS' },
      data: {
        type: 'object',
        properties: {
          orderId: { type: 'string', example: 'ORD-99214' },
          status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], example: 'PROCESSING' },
          bundleId: { type: 'string', example: 'mtn_10gb_promo' },
          recipientPhone: { type: 'string', example: '0241112233' },
          network: { type: 'string', example: 'MTN' },
          amountPesewas: { type: 'integer', example: 5700 },
          balanceAfterPesewas: { type: 'integer', example: 145000 },
          networkReference: { type: 'string', example: 'BB_TELCO_99410' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },

  BundleItem: {
    type: 'object',
    properties: {
      bundleId: { type: 'string', example: 'mtn_10gb_promo' },
      network: { type: 'string', example: 'MTN' },
      name: { type: 'string', example: 'MTN 10GB Executive Package' },
      volumeMb: { type: 'integer', example: 10240 },
      pricePesewas: { type: 'integer', example: 5700 },
      validity: { type: 'string', example: 'NON_EXPIRING' },
    },
  },
};

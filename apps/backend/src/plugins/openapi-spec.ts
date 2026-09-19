/**
 * Authoritative Public Developer OpenAPI 3.1 Specification for ByteBeacon 2.0.
 * Defines public developer contract for Telecom Recipient Precheck, Asynchronous
 * Validation Jobs, Data Order Dispatch & Tracking, Catalog, Wallet Balances,
 * and Webhook Event Subscriptions.
 */

export const openApiPaths: Record<string, any> = {
  // 1. RECIPIENT / BENEFICIARY PRECHECK
  '/api/v1/orders/beneficiaries/precheck': {
    post: {
      tags: ['Beneficiaries & Up2U'],
      summary: 'Public Recipient Eligibility Precheck',
      description:
        'Validates Ghanaian mobile subscriber numbers for eligibility. Returns normalized MSISDNs and validation status.',
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
                  items: { type: 'string', example: '0240000000' },
                  description: 'Array of Ghanaian MSISDNs (max 500 numbers per batch)',
                },
                record: {
                  type: 'boolean',
                  default: false,
                  description: 'When true, logs unapproved numbers to pending queue for verification',
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
        '400': { description: 'Bad Request - invalid phone format or unsupported network' },
        '429': { description: 'Rate Limit Exceeded' },
      },
    },
  },

  '/api/v1/beneficiaries/precheck': {
    post: {
      tags: ['Beneficiaries & Up2U'],
      summary: 'High-Capacity Recipient Precheck',
      description:
        'High-capacity recipient precheck supporting up to 1,000 numbers per request with authenticated caller attribution.',
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
                  items: { type: 'string', example: '0240000000' },
                  description: 'Array of recipient numbers (up to 1,000)',
                },
                record: {
                  type: 'boolean',
                  default: false,
                  description: 'Opt-in to record unapproved numbers for verification',
                },
                bypassCache: {
                  type: 'boolean',
                  default: false,
                  description: 'Request a fresh eligibility check instead of using a cached result',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Precheck evaluated successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PrecheckResponse' },
            },
          },
        },
        '401': { description: 'Unauthorized - invalid or missing API key' },
      },
    },
  },

  '/api/v1/agent/beneficiaries/precheck': {
    post: {
      tags: ['Beneficiaries & Up2U'],
      summary: 'Agent Reseller Beneficiary Precheck',
      description:
        'Authoritative recipient precheck endpoint for integrated reseller platforms and agents.',
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
                phoneNumbers: { type: 'array', items: { type: 'string', example: '0240000000' } },
                record: { type: 'boolean', default: false },
                bypassCache: {
                  type: 'boolean',
                  default: false,
                  description: 'Request a fresh eligibility check instead of using a cached result',
                },
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
      summary: 'Initiate Asynchronous Verification Job',
      description:
        'Submits up to 10,000 phone numbers for background verification. Returns HTTP 202 Accepted with a unique Job ID to poll for progress.',
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
                  items: { type: 'string', example: '0240000000' },
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
        'Polls real-time progress for an asynchronous verification job, including processed count, percentage, summary status, and recipient outcomes.',
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
      description: 'Aborts a running asynchronous verification job and stops further processing.',
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

  // 3. ORDER DISPATCH (SINGLE & BULK)
  '/api/v1/agent/orders': {
    post: {
      tags: ['Orders'],
      summary: 'Create Single Data Bundle Order',
      description:
        'Dispatches a telecom data bundle to a recipient MSISDN. Validates wallet balance and enforces idempotency to prevent duplicate charges.',
      operationId: 'createAgentOrder',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Unique UUID v4 to prevent duplicate billing on network retries',
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
                bundleId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
                phoneNumber: { type: 'string', example: '0240000000' },
                network: { type: 'string', enum: ['MTN', 'TELECEL', 'AIRTELTIGO'], example: 'MTN' },
                idempotencyKey: { type: 'string', format: 'uuid' },
                email: { type: 'string', example: 'customer@example.com' },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Order created and queued for fulfillment',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderEnvelope' },
            },
          },
        },
        '400': { description: 'Invalid phone number or bundle ID' },
        '402': { description: 'Insufficient wallet balance' },
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
      description: 'Fetch fulfillment status, delivery confirmation, and timestamps for a specific order.',
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
      summary: 'Bulk Order Dispatch',
      description:
        'Submits a batch of data bundle dispatches for multiple recipients. Validates available balance and queues orders for fulfillment.',
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
                      phoneNumber: { type: 'string', example: '0240000000' },
                      bundleId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
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
        '402': { description: 'Insufficient wallet balance for bulk dispatch' },
      },
    },
  },

  // 4. CATALOG & BUNDLES
  '/api/v1/agent/bundles': {
    get: {
      tags: ['Catalog'],
      summary: 'Query Available Data Bundles (Agent Wholesale Pricing)',
      description:
        'Returns active data bundle packages, volume quotas, and wholesale agent pricing across supported networks.',
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

  // 5. WALLET & USAGE TELEMETRY
  '/api/v1/agent/wallet/balance': {
    get: {
      tags: ['Wallet & Telemetry'],
      summary: 'Get Prepaid Wallet Balance',
      description:
        'Query current available balance, currency, and account standing in pesewas and formatted GHS. Balance is strictly derived from the authenticated caller identity.',
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
        'Returns request volume, response latency percentiles, error rates, and quota status for the authenticated key.',
      operationId: 'getApiUsageMetrics',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Telemetry metrics and invocation breakdown',
        },
      },
    },
  },

  // 6. WEBHOOKS
  '/api/v1/agent/webhooks': {
    post: {
      tags: ['Webhooks'],
      summary: 'Register Webhook Endpoint',
      description:
        'Configures an HTTPS URL to receive signed real-time order and status notifications. The server generates an HMAC-SHA256 signing secret that is displayed once upon creation.',
      operationId: 'registerAgentWebhook',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['url', 'events'],
              properties: {
                url: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://example.com/api/webhooks/bytebeacon',
                  description: 'Valid HTTPS endpoint destination',
                },
                events: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: [
                      'order.completed',
                      'order.processing',
                      'order.failed',
                      'beneficiary.approved',
                      'beneficiary.rejected',
                      'wallet.credited',
                      'wallet.debited',
                    ],
                    example: 'order.completed',
                  },
                  description: 'Array of event subscriptions',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Webhook registered successfully. Signing secret returned once in response.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  statusCode: { type: 'integer', example: 201 },
                  message: { type: 'string', example: 'Subscription created. The secret is shown ONCE — store it now.' },
                  data: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'wh_sub_01J9X8Y7' },
                      agentId: { type: 'string', example: 'agent_01J9X8Y7' },
                      url: { type: 'string', example: 'https://example.com/api/webhooks/bytebeacon' },
                      events: { type: 'array', items: { type: 'string' } },
                      isActive: { type: 'boolean', example: true },
                      createdAt: { type: 'string', format: 'date-time' },
                      signingSecret: { type: 'string', example: 'whsec_EXAMPLE_SIGNING_SECRET_STRING' },
                    },
                  },
                },
              },
            },
          },
        },
        '400': { description: 'Invalid HTTPS URL or unsupported event subscription' },
      },
    },
    get: {
      tags: ['Webhooks'],
      summary: 'List Registered Webhooks',
      description: 'Returns all active webhook endpoints configured for the authenticated agent.',
      operationId: 'listAgentWebhooks',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      responses: {
        '200': { description: 'Active webhook subscriptions' },
      },
    },
  },

  '/api/v1/agent/webhooks/{id}': {
    delete: {
      tags: ['Webhooks'],
      summary: 'Delete Webhook Endpoint',
      description: 'Removes an active webhook subscription by ID.',
      operationId: 'deleteAgentWebhook',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Webhook subscription ID' },
      ],
      responses: {
        '200': { description: 'Webhook deleted successfully' },
        '404': { description: 'Webhook not found' },
      },
    },
  },

  '/api/v1/agent/webhooks/{id}/rotate-secret': {
    post: {
      tags: ['Webhooks'],
      summary: 'Rotate Webhook Signing Secret',
      description: 'Generates a new HMAC signing secret for an existing webhook subscription and invalidates the old secret.',
      operationId: 'rotateAgentWebhookSecret',
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Webhook subscription ID' },
      ],
      responses: {
        '200': {
          description: 'Secret rotated successfully. New secret displayed once in response.',
        },
        '404': { description: 'Webhook not found' },
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
              total: { type: 'integer', example: 10 },
              approved: { type: 'integer', example: 8 },
              unapproved: { type: 'integer', example: 2 },
              rejected: { type: 'integer', example: 0 },
            },
          },
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                phone: { type: 'string', example: '0240000000' },
                normalized: { type: 'string', example: '+233240000000' },
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
      totalRows: { type: 'integer', example: 10 },
      processedRows: { type: 'integer', example: 10 },
      percent: { type: 'number', example: 100 },
      approvedCount: { type: 'integer', example: 8 },
      unapprovedCount: { type: 'integer', example: 2 },
      rejectedCount: { type: 'integer', example: 0 },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            phone: { type: 'string', example: '0240000000' },
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
          bundleId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          recipientPhone: { type: 'string', example: '0240000000' },
          network: { type: 'string', example: 'MTN' },
          amountPesewas: { type: 'integer', example: 5700 },
          balanceAfterPesewas: { type: 'integer', example: 145000 },
          networkReference: { type: 'string', example: 'BB_REF_100234' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },

  BundleItem: {
    type: 'object',
    properties: {
      bundleId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
      network: { type: 'string', example: 'MTN' },
      name: { type: 'string', example: 'MTN 10GB Non-Expiry' },
      volumeMb: { type: 'integer', example: 10240 },
      pricePesewas: { type: 'integer', example: 5700 },
      validity: { type: 'string', example: 'NON_EXPIRING' },
    },
  },
};

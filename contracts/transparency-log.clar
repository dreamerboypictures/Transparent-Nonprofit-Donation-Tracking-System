(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-ACTION-TYPE u101)
(define-constant ERR-INVALID-DONATION-ID u102)
(define-constant ERR-INVALID-NONPROFIT-ID u103)
(define-constant ERR-INVALID-DETAILS u104)
(define-constant ERR-LOG-ID-NOT-FOUND u105)
(define-constant ERR-PAGINATION-INVALID u106)
(define-constant ERR-QUERY-LIMIT-EXCEEDED u107)
(define-constant ERR-LOG-ALREADY-EXISTS u108)
(define-constant ERR-INVALID-LOG-STATUS u109)
(define-constant ERR-UNAUTHORIZED-QUERY u110)

(define-data-var log-counter uint u0)
(define-data-var max-logs-per-query uint u50)
(define-data-var query-limit uint u1000)
(define-data-var admin-principal (optional principal) none)

(define-map transparency-log
  { log-id: uint }
  {
    action-type: (string-ascii 20),
    donation-id: uint,
    nonprofit-id: uint,
    details: (string-ascii 256),
    timestamp: uint,
    status: bool,
    verifier: (optional principal),
    evidence-hash: (optional (string-ascii 64))
  }
)

(define-map log-indexes
  { donation-id: uint }
  (list 200 uint)
)

(define-map nonprofit-indexes
  { nonprofit-id: uint }
  (list 200 uint)
)

(define-map action-type-indexes
  { action-type: (string-ascii 20) }
  (list 200 uint)
)

(define-public (set-admin-principal (new-principal principal))
  (begin
    (asserts! (is-none (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-principal tx-sender)) (err ERR-NOT-AUTHORIZED))
    (var-set admin-principal (some new-principal))
    (ok true)
  )
)

(define-public (set-max-logs-per-query (new-max uint))
  (begin
    (asserts! (is-some (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (and (> new-max u0) (<= new-max u100)) (err ERR-PAGINATION-INVALID))
    (var-set max-logs-per-query new-max)
    (ok true)
  )
)

(define-public (set-query-limit (new-limit uint))
  (begin
    (asserts! (is-some (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-limit u0) (err ERR-PAGINATION-INVALID))
    (var-set query-limit new-limit)
    (ok true)
  )
)

(define-private (validate-action-type (action-type (string-ascii 20)))
  (if (or
        (is-eq action-type "donation-received")
        (is-eq action-type "fund-allocated")
        (is-eq action-type "spending-submitted")
        (is-eq action-type "spending-verified")
        (is-eq action-type "spending-rejected")
        (is-eq action-type "audit-completed"))
      (ok true)
      (err ERR-INVALID-ACTION-TYPE))
)

(define-private (validate-donation-id (donation-id uint))
  (if (> donation-id u0)
      (ok true)
      (err ERR-INVALID-DONATION-ID))
)

(define-private (validate-nonprofit-id (nonprofit-id uint))
  (if (> nonprofit-id u0)
      (ok true)
      (err ERR-INVALID-NONPROFIT-ID))
)

(define-private (validate-details (details (string-ascii 256)))
  (if (<= (len details) u256)
      (ok true)
      (err ERR-INVALID-DETAILS))
)

(define-private (validate-evidence-hash (evidence-hash (string-ascii 64)))
  (if (and (<= (len evidence-hash) u64) (> (len evidence-hash) u0))
      (ok true)
      (err ERR-INVALID-DETAILS))
)

(define-private (is-authorized-caller)
  (or
    (is-eq contract-caller .donation-manager)
    (is-eq contract-caller .fund-allocator)
    (is-eq contract-caller .spending-submitter)
    (is-eq contract-caller .auditor-verifier)
    (is-eq contract-caller tx-sender))
)

(define-public (log-action
  (action-type (string-ascii 20))
  (donation-id uint)
  (nonprofit-id uint)
  (details (string-ascii 256))
  (evidence-hash (optional (string-ascii 64)))
)
  (let
    (
      (counter (var-get log-counter))
      (authorized (is-authorized-caller))
    )
    (asserts! authorized (err ERR-NOT-AUTHORIZED))
    (try! (validate-action-type action-type))
    (try! (validate-donation-id donation-id))
    (try! (validate-nonprofit-id nonprofit-id))
    (try! (validate-details details))
    (asserts! (is-none (map-get? transparency-log { log-id: counter })) (err ERR-LOG-ALREADY-EXISTS))
    (match evidence-hash
      hash-value
      (try! (validate-evidence-hash hash-value))
      (ok true))
    (map-set transparency-log
      { log-id: counter }
      {
        action-type: action-type,
        donation-id: donation-id,
        nonprofit-id: nonprofit-id,
        details: details,
        timestamp: block-height,
        status: true,
        verifier: none,
        evidence-hash: evidence-hash
      }
    )
    (try! (update-indexes counter action-type donation-id nonprofit-id))
    (var-set log-counter (+ counter u1))
    (print { event: "log-created", log-id: counter, action: action-type })
    (ok counter)
  )
)

(define-public (update-log-status
  (log-id uint)
  (new-status bool)
  (verifier principal)
)
  (let
    (
      (existing (map-get? transparency-log { log-id: log-id }))
    )
    (match existing
      log-entry
        (begin
          (asserts! (is-authorized-caller) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (is-eq (get status log-entry) new-status)) (err ERR-INVALID-LOG-STATUS))
          (map-set transparency-log
            { log-id: log-id }
            {
              action-type: (get action-type log-entry),
              donation-id: (get donation-id log-entry),
              nonprofit-id: (get nonprofit-id log-entry),
              details: (get details log-entry),
              timestamp: (get timestamp log-entry),
              status: new-status,
              verifier: (some verifier),
              evidence-hash: (get evidence-hash log-entry)
            }
          )
          (print { event: "log-status-updated", log-id: log-id, status: new-status })
          (ok true)
        )
      (err ERR-LOG-ID-NOT-FOUND)
    )
  )
)

(define-private (update-indexes
  (log-id uint)
  (action-type (string-ascii 20))
  (donation-id uint)
  (nonprofit-id uint)
)
  (begin
    (try! (append-to-index log-indexes { donation-id: donation-id } log-id))
    (try! (append-to-index nonprofit-indexes { nonprofit-id: nonprofit-id } log-id))
    (try! (append-to-index action-type-indexes { action-type: action-type } log-id))
    (ok true)
  )
)

(define-private (append-to-index
  (index-map (map { key: uint } (list 200 uint)))
  (key { key: uint })
  (value uint)
)
  (let
    (
      (current-list (default-to (list ) (map-get? index-map key)))
      (new-list (unwrap! (as-max-len? (append current-list value) u200) (err ERR-QUERY-LIMIT-EXCEEDED)))
    )
    (ok (map-set index-map key new-list))
  )
)

(define-read-only (get-log (log-id uint))
  (map-get? transparency-log { log-id: log-id })
)

(define-read-only (get-logs-by-donation
  (donation-id uint)
  (start uint)
  (limit uint)
)
  (let
    (
      (index (unwrap! (map-get? log-indexes { donation-id: donation-id }) (list )))
      (max-limit (var-get max-logs-per-query))
      (adjusted-limit (if (> limit max-limit) max-limit limit))
    )
    (asserts! (and (>= start u0) (<= adjusted-limit u50)) (err ERR-PAGINATION-INVALID))
    (ok (paginate-list index start adjusted-limit))
  )
)

(define-read-only (get-logs-by-nonprofit
  (nonprofit-id uint)
  (start uint)
  (limit uint)
)
  (let
    (
      (index (unwrap! (map-get? nonprofit-indexes { nonprofit-id: nonprofit-id }) (list )))
      (max-limit (var-get max-logs-per-query))
      (adjusted-limit (if (> limit max-limit) max-limit limit))
    )
    (asserts! (and (>= start u0) (<= adjusted-limit u50)) (err ERR-PAGINATION-INVALID))
    (ok (paginate-list index start adjusted-limit))
  )
)

(define-read-only (get-logs-by-action-type
  (action-type (string-ascii 20))
  (start uint)
  (limit uint)
)
  (let
    (
      (index (unwrap! (map-get? action-type-indexes { action-type: action-type }) (list )))
      (max-limit (var-get max-logs-per-query))
      (adjusted-limit (if (> limit max-limit) max-limit limit))
    )
    (asserts! (and (>= start u0) (<= adjusted-limit u50)) (err ERR-PAGINATION-INVALID))
    (ok (paginate-list index start adjusted-limit))
  )
)

(define-read-only (get-total-logs)
  (ok (var-get log-counter))
)

(define-read-only (get-log-count-by-donation (donation-id uint))
  (ok (len (unwrap! (map-get? log-indexes { donation-id: donation-id }) (list ))))
)

(define-read-only (get-log-count-by-nonprofit (nonprofit-id uint))
  (ok (len (unwrap! (map-get? nonprofit-indexes { nonprofit-id: nonprofit-id }) (list ))))
)

(define-read-only (get-log-count-by-action-type (action-type (string-ascii 20)))
  (ok (len (unwrap! (map-get? action-type-indexes { action-type: action-type }) (list ))))
)

(define-private (paginate-list (full-list (list 200 uint)) (start uint) (limit uint))
  (fold
    (lambda (acc idx)
      (if (and (>= idx start) (< (len acc) limit))
          (unwrap! (as-max-len? (append acc (unwrap! (map-get? transparency-log { log-id: idx }) none)) u50)
            acc)
          acc
      )
    )
    (list )
    full-list
  )
)
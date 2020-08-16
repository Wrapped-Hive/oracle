#### Wrapped Hive

HIVE tokens wrapped in ERC-20 tokens

---

API:

Response format: JSON

---

`POST` `/create`

Create new conversion (WHIVE -> HIVE) request and ethereum deposit address.

Deposit address reservation will expire in 7 days and address will be reused.

Params: `username` (Hive username)

On error:

`{success: false, message: "error_message"}`

On success:

`{success: true, message: "transaction_created", id: uuid, address: ethereum_address, expiration: javascript_timestamp}`

---

`GET` `/get_addresses`

List all addresses belonging to this project (deposit wallets...), used to verify total supply in circulation, since tokens are not burned immediately to save money on fees.

On error:

`{success: false, message: "error_message"}`

On success:

`{success: true, message: "success", addresses: [array_of_addresses]}`

---

`GET` `/ping`

On success:

`{message: "pong", timestamp: javascript_timestamp}`

---

How to use `src/utils/deposit_private_keys.js` to generate private keys for deposit addresses?

Run: `SEED='here goes your memonic phrase' node src/utils/deposit_private_keys.js`

---

Database: MongoDB

Collection: `addresses`

Collection: `status`

```
{
  _id: someid,
  type: "nonce",
  nonce: 0
}
```

Collection: `transactions`

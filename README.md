#### Wrapped WEED

wWEED tokens wrapped in ERC-20 tokens

---

***Abstract***

WWEED oracle serves as an exchange between WEED and wWEED, ERC20 tokens on Ethereum network.

When new deposits with Ethereum address as memo are received, app will mint new wWEED tokens and sent them to user.
To process the withdraw from wWEED to WEED, app generates deposit address for each user with 7 days expiration.

This allows for address reuse and reduce number of addresses to monitor (and later burn deposited wWEED) to save on ETH fees. To process the wWEED transfers, app use https://ethplorer.io API.

---

API:

Response format: JSON

---

`POST` `/create`

Create new conversion (wWEED -> WEED) request and ethereum deposit address.

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

`GET` `/status`

On success:

`{deposit: config.hiveAccount, minAmount: config.min_amount, maxAmount: maxAmount}`

---

Database: MongoDB, name: `ETH-HIVE`

Collection: `addresses`

Collection: `status`

```
{
  _id: someid,
  type: "token_nonce",
  nonce: 0
},
{
  _id: someid,
  type: "token_fee",
  fee: "51.000"
}
```

Collection: `transactions`

Collection: `errors`

---

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

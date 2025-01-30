// deno-lint-ignore-file
class Chatbox extends HTMLElement {
    #shadow;
    #listItemIds;
    #open = true;

    constructor() {
        super();
        this.#listItemIds = new Set();
    }

    pushItem({ id, at, name, msg, me }) {
        const ol = $(this.#shadow.querySelector(".content > ol"));
        const has = this.#listItemIds.has(id);

        // FIXME: How to use at?
        if (has) {
            ol[0].querySelector(`#message-item-${id} .loading`)
                .classList.remove("loading");
        } else {
            ol.children("li.placeholder").remove();
            this.#listItemIds.add(id);
            const listItem = $('<li class="row" />')
                .attr("id", `message-item-${id}`)
                .addClass(me ? "me" : "other")
                .append(
                    $(
                        me
                            ? '<span class="me loading" />'
                            : '<span class="other loading" />',
                    )
                        .append(
                            $('<span class="name" />').text(me ? "Me" : name),
                        )
                        .append(
                            $('<p class="message-text" />').text(msg),
                        ),
                );
            ol.append(listItem);
            listItem.ready(() => {
                listItem.children(".other.loading").removeClass("loading");
                ol.scrollTop(ol[0].scrollHeight);
            });
        }
    }

    connectedCallback() {
        const shadow = this.attachShadow({ mode: "open" });
        const style = document.createElement("style");

        style.textContent = `
            .container {
                position: fixed;
                right: 5px;
                bottom: 0;
                width: 250px;
                height: 400px;
                transition: height 0.2s ease-in;
                display: flex;
                flex-direction: column;
                border: 1px solid black;
                box-sizing: border-box;
            }

            .header {
                flex: 0 0 30px;
                background-color: grey;
                color: white;
                padding-left: 5px;
                cursor: pointer;
                display: inline-block;

                > * {
                    vertical-align: middle;
                }
            }

            .content {
                flex: 1 1 0;
                background-color: white;

                display: flex;
                flex-direction: column;

                > ol {
                    overflow: scroll;
                    list-style-type: none;
                    flex: 1 1 0;
                    margin: 0;
                    padding: 5px;
                    position: relative;

                    > li.placeholder {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        text-align: center;
                        width: 100%;
                        transform: translate(-50%, -50%);
                    }
                }
            }

            li.row.me {
                text-align: right;
            }

            li.row {
                margin: 2px 0;
                width: 100%;

                > span {
                    display: inline-flex;
                    flex-direction: column;
                    min-width: 100px;
                    max-width: 200px;
                    border-radius: 3px;
                    color: black;
                    padding: 2px 5px;
                    transition: background-color 0.3s ease-in;
                }

                p {
                    margin: 0;
                    overflow-wrap: break-word;
                }

                .name {
                    font-size: 9px;
                }

                .me.loading, .other.loading {
                    background-color: white;
                    border: 1px solid black;
                }

                .other {
                    background-color: grey;
                }

                .me {
                    background-color: rgb(91, 191, 245);
                    text-align: right;
                }
            }

            form.single-line {
                width: 100%;
                height: 1.5em;
                position: relative;

                input[type="text"] {
                    padding-left: 5px;
                    padding-right: 53px;
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    border: none;
                    border-top: 1px dashed black;
                }

                input[type="submit"] {
                    position: absolute;
                    display: inline-block;
                    width: 50px;
                    right: 2px;
                    top: 50%;
                    transform: translateY(-50%);
                    font-weight: 600;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                }

                input[type="submit"][disabled] {
                    cursor: not-allowed;
                    color: grey;
                }
            }
        `;
        const wrapper = $(`
            <div class="container">
            </div>
        `);
        const header = $(`
            <div class="header">
                <span>Chat</span>
            </div>
        `);
        const content = $(`
            <div class="content">
                <ol>
                    <li class="placeholder">New chats will appear here</li>
                </ol>
            </div>
        `);
        const form = $(`
            <form class="single-line">
                <input type="text" placeholder="Type something..." maxlength="2048" />
                <input type="submit" disabled value="Send" />
            </form>
        `);

        content.append(form);
        wrapper.append(header).append(content);

        shadow.appendChild(style);
        $(shadow).append(wrapper);
        form.children('input[type="text"]').on("input", (event) => {
            const { value } = event.target;
            form.children('input[type="submit"]').attr(
                "disabled",
                value.length === 0,
            );
        });
        form.on("submit", (event) => {
            event.preventDefault();
            const text = form.children('input[type="text"]');
            const value = text.val();
            this.dispatchEvent(
                new CustomEvent("submit", {
                    detail: {
                        value,
                    },
                }),
            );
            text.val("");
            form.children('input[type="submit"]').attr("disabled", true);
        });
        header.on("click", () => {
            if (this.#open) {
                $(wrapper).css("height", "30px");
            } else {
                $(wrapper).css("height", "400px");
            }

            this.#open = !this.#open;
        });

        this.#shadow = shadow;
    }
}

function register(name = "chat-box") {
    window.customElements.define(name, Chatbox);
}

export default register;

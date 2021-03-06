// ==UserScript==
// @name         habrahabr.ru
// @namespace    http://tampermonkey.net/
// @version      1.3.4
// @description  Flat view of comments + tooltips
// @author       a.sitnikov
// @match        habr.com/*
// @match        geektimes.com/*
// @grant        none
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @downloadURL  https://cdn.jsdelivr.net/gh/a-sitnikov/TamperMonkey-Scripts@latest/habr.js
// @updateURL    https://cdn.jsdelivr.net/gh/a-sitnikov/TamperMonkey-Scripts@latest/habr.js
// ==/UserScript==
/* global $ */

let tooltipsOrder = [];
let tooltipsMap = {};

function removeTooltip() {
    // remove all subsequent tooltips
    let msgId = $(this).attr("msg-id");
    let ind = tooltipsOrder.indexOf(msgId);
    for (let i = ind; i < tooltipsOrder.length; i++) {
        let tempMsgId = tooltipsOrder[i];
        if (tooltipsMap[tempMsgId]) tooltipsMap[tempMsgId].remove();
        tooltipsMap[tempMsgId] = null;
    }
    tooltipsOrder.splice(ind);
}

function removeAllTooltips() {
    // remove all subsequent tooltips
    for (let i = 0; i < tooltipsOrder.length; i++) {
        let tempMsgId = tooltipsOrder[i];
        if (tooltipsMap[tempMsgId]) tooltipsMap[tempMsgId].remove();
        tooltipsMap[tempMsgId] = null;
    }
    tooltipsOrder = [];
}

function tooltipHtml(msgId) {
    //min-width: 500px; width:auto; max-width: 1200px
    let html =
        `<div id="tooltip_id${msgId}" msg-id="${msgId}" style="position:absolute; background:white; border:2px solid LightGray; width:650px; font-weight:normal; padding: 10px">
<div id="tooltip-text${msgId}" msg-id="${msgId}" class="tooltip-text">
</div>
</div>`;
    return html;
}

function createTooltip(link, msgId) {

    let locDiv = $("div.comment").offset();
    let loc = link.offset();
    let left = locDiv.left + 10;
    let top = loc.top - 80;

    let tooltip = $(`#tooltip_id${msgId}`);
    if (tooltip.length > 0) {
        tooltip.css({
            "top": top + "px",
            "left": left + "px"
            //"z-index": "999"
        });
        return;
    }

    tooltip = $(tooltipHtml(msgId)).appendTo('body');

    let elem = tooltip
    .draggable()
    .css({
        "top": top + "px",
        "left": left + "px",
        "z-index": "999"
    })
    .click(removeTooltip);

    tooltipsMap[msgId] = elem;
    tooltipsOrder.push(msgId);

    return elem;
}

function setMsgText(msgId, elemHeader, elemText){

    let text = $(`#comment_${msgId}`).html();
    elemText.html(text);
    elemText.find('img').css({'max-width': '642px'});

    elemText.find("a[linkid]").each((i, val) => {
        let parentLink = $(val);
        let parentId = parentLink.attr("linkid");
        attachTooltip(parentLink, parentId, loadDataMsg(parentId));
    });

}

function loadDataMsg(msgId){
    return function() {
        setMsgText(msgId, $(`#tooltip-header${msgId}`), $(`#tooltip-text${msgId}`));
    };
}

function attachTooltip(link, msgId, loadDataFunc) {

    let timer;
    link.hover(function(){
        timer = setTimeout(function() {
            createTooltip(link, msgId);
            loadDataFunc();
        }, 500);
    },
               function() {
        // on mouse out, cancel the timer
        clearTimeout(timer);
    });

    link.mousedown(function(event){
        clearTimeout(timer);
    });
}

function hideNodes(enableMinRating, minRating) {
    $("div.comment").each((i, val) => {
        let node = $(val);
        let {rating} = node.data();
        let nodeVisible = !enableMinRating || (rating >= minRating);
        if (nodeVisible)
            node.show();
        else
            node.hide();
    });
}

(function() {
    'use strict';

    $('body').click(function(e){
        if ($(e.target).closest('div[id^=tooltip_id]').length === 0) removeAllTooltips();
    });

    let comments = $("div.comment");
    let arr = comments.map((i, val) => {
        let node = $(val);
        node.css({"margin-top": "10px"});
        let parentId = node.prev().attr("data-parent_id");
        let nodeId   = node.attr("id").split("_")[1];

        let text = node.find("time").text();
        let [date, time] = text.split(" в ");
        let [d, m, y] = date.split(".");
        let [h, min] = time.split(":");
        let commentDate = new Date(+("20" + y), +m - 1, +d, +h, +min);

        let rating = node.find("span.js-score").text();
        rating = parseInt(rating.replace(String.fromCharCode(8211), "-"));

        return {date: commentDate, node, nodeId, parentId, rating};
    });

    arr.sort((x, y) => (x.date > y.date));

    let commentNumbers = new Map();
    arr.each((i, val) => {
        commentNumbers.set(val.nodeId, +i+1);
    });

    let parent = $("#comments-list");
    parent.empty();

    for (let i in arr) {

        let {node, nodeId, parentId, rating} = arr[i];
        if (!node) continue;

        let i1 = +i + 1;
        let parentNumber = commentNumbers.get(parentId);

        node.data({nodeId, rating});
        parent.append(node);

        let nodeNumberElem = $(`<span class="user-info__nickname_comment">${i1}.</span>`).insertBefore(node.find("a.user-info"));
        nodeNumberElem.css({"margin-right": "5px"});

        if (parentId !== "0" /*&& parentNumber*/) {
            let parentLink = $(`<a href="#comment_${parentId}" linkid=${parentId}>(${parentNumber})</a>`);
            parentLink = parentLink.insertBefore(node.find("div.voting-wjt"));
            attachTooltip(parentLink, parentId, loadDataMsg(parentId));
        }

        const childrenNodes = arr.filter((i, val) => val.parentId === nodeId).sort((x, y) => x.nodeId > y.nodeId);
        if (childrenNodes.length > 0) {
            for (let j=0; j<childrenNodes.length; j++) {
                const childNode = childrenNodes[j];
                const childNumber = commentNumbers.get(childNode.nodeId);
                //let div = childNode.node; //.find('div.comment');
                //let childNumberElem = $(`<span>${childNumber}.</span>`).css({"margin": " auto 5px auto 25px"});
                //div = div.prepend(childNumberElem);
                let div = $(`<a href="#comment_${childNode.nodeId}" linkid=${childNode.nodeId}>(${childNumber})</a>`).css({"margin": "0px 5px"});
                let replyLink = node.find('a[href="#reply"]');
                div.insertBefore(replyLink);
                attachTooltip(div, childNode.nodeId, loadDataMsg(childNode.nodeId));
            }
        }
    }

    let enableMinRating = (localStorage.getItem('enableMinRating') || 'true') === 'true';
    let minRating = parseInt(localStorage.getItem('minRating') || '1');

    hideNodes(enableMinRating, minRating);

    let checkbox = $(`<input id="enableMinRating" type="checkbox" name="enableMinRating" style="margin-left:7px">`);
    checkbox.on('change', function(){
        let enableMinRating = $(this).is(':checked');
        let minRating = $('#minRating').val();
        hideNodes(enableMinRating, +minRating);
        localStorage.setItem('enableMinRating', String(enableMinRating));
    }).prop("checked", enableMinRating ? "checked" : "");

    let input = $(`<input id="minRating" name="minRating" type="number" value="${minRating}" min="0" style="margin-left:7px; width: 50px; text-align:right"></input>`);
    input.on('change', function(){
        let enableMinRating = $('#enableMinRating').is(':checked');
        let minRating = $('#minRating').val();
        hideNodes(enableMinRating, +minRating);
        localStorage.setItem('minRating', minRating);
    });
    $('span.checkbox-group')
        .append(checkbox)
        .append($('<label for="enableMinRating" class="subscribe_comments">Мин. карма</label>'))
        .append(input);

})();

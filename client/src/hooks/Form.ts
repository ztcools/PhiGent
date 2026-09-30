import { useState } from 'react';
import { checkEmptyValid, getCheckResult } from '../utils/Validation';
import type { IValidation } from '../components/customInput/Types';

export interface IForm {
  key: string;
  value?: any;
  needCheck?: boolean;
}

interface IValidationInfo {
  // 校验表单整体合法性
  checkFormValid: Function;
  // 校验单个表单项
  checkIsValid: Function;
  validation: {
    [key: string]: IValidationItem;
  };
  disabled: boolean;
  setDisabled: Function;
  resetValidation: (form: IForm[]) => void;
}

export interface IValidationItem {
  result: boolean;
  errText: string;
}

export interface ICheckValidParam {
  value: string;
  key: string;
  // 一个输入框可以包含多条规则
  rules: IValidation[];
}

// 表单与元素引用
export const useFormValidation = (form: IForm[]): IValidationInfo => {
  const initValidation = form
    .filter(f => f.needCheck)
    .reduce(
      (acc, cur) => ({
        ...acc,
        [cur.key]: {
          result:
            typeof cur.value === 'string' ? cur.value === '' : cur.value === 0,
          errText: '',
        },
      }),
      {}
    );

  // 各表单项的校验详情
  const [validation, setValidation] = useState(initValidation);
  // 整体校验结果，用于控制后续操作
  const isOverallValid = Object.values(validation).every(
    v => !(v as IValidationItem).result
  );
  const [disabled, setDisabled] = useState<boolean>(!isOverallValid);

  const checkIsValid = (param: ICheckValidParam): IValidationItem => {
    const { value, key, rules } = param;

    let validDetail = {
      result: false,
      errText: '',
    };

    const hasRequire = rules.some(r => r.rule === 'require');

    // 值为空且没有 require 规则时，跳过本次校验
    if (!checkEmptyValid(value) && !hasRequire) {
      setDisabled(false);
      return validDetail;
    }

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      const checkResult = getCheckResult({
        value,
        extraParam: rule.extraParam,
        rule: rule.rule,
      });

      if (!checkResult) {
        validDetail = {
          result: true,
          errText: rule.errorText || '',
        };

        break;
      }
    }

    const validInfo = {
      ...validation,
      [key]: validDetail,
    };

    const isOverallValid = Object.values(validInfo).every(
      v => !(v as IValidationItem).result
    );

    setDisabled(!isOverallValid);
    setValidation(validInfo);

    return validDetail;
  };

  const checkFormValid = (elementClass: string) => {
    // 查找需要校验的 DOM 元素
    const elements = document.querySelectorAll(
      elementClass
    ) as NodeListOf<HTMLElement>;
    // 触发 blur
    elements.forEach(element => {
      // 渲染完成后用 setTimeout 触发 blur 事件
      setTimeout(() => {
        // 调用 HTMLElement.prototype.blur 触发 blur 事件
        element.focus();
        element.blur();
      }, 0);
    });
  };

  const resetValidation = (form: IForm[]) => {
    const validation = form
      .filter(f => f.needCheck)
      .reduce(
        (acc, cur) => ({
          ...acc,
          [cur.key]: { result: cur.value === '', errText: '' },
        }),
        {}
      );
    setValidation(validation);
  };

  return {
    checkFormValid,
    checkIsValid,
    validation,
    disabled,
    setDisabled,
    resetValidation,
  };
};
